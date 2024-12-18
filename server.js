const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Pusher = require("pusher");
const DateTimePatterns = require("./utils/DateTimePatterns");
const DateTimeResolver = require("./utils/DateTimeResolver");
const FeedbackProcessor = require("./utils/FeedbackProcessor");
const TaskParsingLog = require("./models/TaskParsingLog");
const {
  TASK_PARSING_LOG_FIELDS: FIELDS,
  METRICS_FIELDS,
  METADATA_FIELDS,
} = require("./models/constants");
const sequelize = require("./config/database");
const { Sequelize } = require("sequelize");
const { SYSTEM_MESSAGE } = require("./llm/system-messages");
const { taskFunctions } = require("./llm/functions");
const {
  handleCreateTask,
  handleUpdateTask,
  handleAnalyzeTaskContext,
} = require("./llm/handlers");

// Load environment variables
dotenv.config();

// Initialize Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024,
  },
});

// Store notifications in memory
let notifications = [];

// Gemini API error handler
async function handleGeminiRequest(requestFn) {
  try {
    return await requestFn();
  } catch (error) {
    if (error.response) {
      console.error("Gemini API Error:", {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      console.error("Gemini API Error:", error);
    }

    if (error.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    if (error.status === 400) {
      throw new Error("Invalid request. Please check your input.");
    }

    if (error.response?.data?.error?.message) {
      throw new Error("Gemini API error: " + error.response.data.error.message);
    } else {
      throw new Error("Gemini API error: " + error.message);
    }
  }
}

// ===== IMPORTANT: INITIALIZE UTILITIES - DO NOT DELETE =====
// Initialize Express app
const app = express();

// Initialize all utilities and components
const dateTimePatterns = new DateTimePatterns();
const dateTimeResolver = new DateTimeResolver();
const feedbackProcessor = new FeedbackProcessor();

// Configure CORS
app.use(
  cors({
    origin: "http://localhost:5173", // Frontend URL
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json());

// Function to broadcast notification using Pusher
function broadcastNotification(type, data) {
  console.log("Broadcasting notification:", { type, data });
  const notification = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  // Only store relevant notifications
  const notificationTypes = [
    "TASK_CREATED",
    "TASK_UPDATED",
    "TASK_DELETED",
    "BULK_UPDATE",
    "BULK_DELETE",
    "ERROR",
  ];

  if (notificationTypes.includes(type)) {
    // Add to notifications array
    notifications.unshift({
      id: Date.now(),
      type,
      message: data.message,
      taskId: data.taskId,
      timestamp: new Date().toISOString(),
      read: false,
      priority: data.priority || "normal",
    });

    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications = notifications.slice(0, 100);
    }
  }

  // Broadcast via Pusher
  pusher
    .trigger("todo-app", "notification", notification)
    .then(() => {
      console.log("Notification broadcast complete via Pusher");
    })
    .catch((error) => {
      console.error("Error broadcasting via Pusher:", error);
    });
}

// Add task parsing endpoint
app.post("/api/parse-task", async (req, res) => {
  console.log("=== Task Parsing Started ===");
  const startTime = Date.now();
  let llmLatency = 0;
  let error = null;
  let parsedResponse = null;

  try {
    const { userInput, requestSource = "text" } = req.body;

    // Validate input
    if (!userInput || typeof userInput !== "string") {
      console.error("Invalid input:", userInput);
      return res.status(400).json({
        success: false,
        error: "Invalid input text",
        feedback: {
          voice: "I need some text to create a task. Could you try again?",
          display: "Please provide task text",
        },
      });
    }

    // Create Gemini chat
    console.log("Getting Gemini response...");
    const llmStartTime = Date.now();

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: SYSTEM_MESSAGE }],
        },
      ],
    });

    const result = await chat.sendMessage(`Create a task from: ${userInput}`, {
      tools: [taskFunctions],
    });

    llmLatency = Date.now() - llmStartTime;
    console.log("Gemini Response:", JSON.stringify(result, null, 2));

    // Extract the JSON from the text response
    const responseText = result.response.candidates[0].content.parts[0].text;
    // Remove markdown code block markers and parse JSON
    const jsonStr = responseText.replace(/```json\n|\n```/g, "");
    parsedResponse = JSON.parse(jsonStr);

    console.log("Parsed response:", JSON.stringify(parsedResponse, null, 2));

    if (!parsedResponse.task) {
      throw new Error("No task data in response");
    }

    // Process task data
    const taskResult = await handleCreateTask(parsedResponse.task);

    // Broadcast notification
    broadcastNotification("TASK_CREATED", {
      message: `New task created: ${taskResult.task.title}`,
      taskId: taskResult.task.id,
      task: taskResult.task,
    });

    // Send successful response
    res.json({
      success: true,
      task: taskResult.task,
      feedback: {
        voice: `I've created a task: ${taskResult.task.title}`,
        display: "Task created successfully",
      },
      analysis: parsedResponse.analysis || {
        completeness: 1.0,
        missing_info: [],
        suggestions: [],
      },
    });
  } catch (err) {
    error = err;
    console.error("=== Task Parsing Failed ===");
    console.error("Error details:", err);

    res.status(500).json({
      success: false,
      error: err.message,
      feedback: {
        voice:
          "I encountered an error while creating your task. Please try again.",
        display: "Error creating task",
      },
    });
  } finally {
    // Log parsing attempt with all required fields
    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    try {
      await TaskParsingLog.create({
        [FIELDS.INPUT]: req.body.userInput,
        [FIELDS.ANONYMIZED_INPUT]: req.body.userInput,
        [FIELDS.INPUT_HASH]: require("crypto")
          .createHash("sha256")
          .update(req.body.userInput)
          .digest("hex"),
        [FIELDS.PARSING_SUCCESS]: !error,
        [FIELDS.LLM_LATENCY]: llmLatency,
        [FIELDS.TOTAL_LATENCY]: totalLatency,
        [FIELDS.ERROR_MESSAGE]: error ? error.message : null,
        [FIELDS.PARSED_OUTPUT]: error
          ? {}
          : {
              task: parsedResponse.task,
              temporal: parsedResponse.task.temporal,
            },
        [FIELDS.METRICS]: {
          [METRICS_FIELDS.PROCESSING_TIME_MS]: totalLatency,
          [METRICS_FIELDS.LLM_LATENCY_MS]: llmLatency,
          [METRICS_FIELDS.PATTERN_MATCH_CONFIDENCE]: 1.0,
        },
        [FIELDS.METADATA]: {
          [METADATA_FIELDS.LLM_MODEL]: "gemini-1.5-flash",
          [METADATA_FIELDS.PROMPT_VERSION]: "1.0",
          [METADATA_FIELDS.PATTERN_VERSION]: "1.0",
        },
      });
    } catch (logError) {
      console.error("Failed to log parsing attempt:", logError);
    }
  }
});

// Add notifications endpoints
app.get("/api/notifications", (req, res) => {
  res.json({
    success: true,
    notifications: notifications,
  });
});

app.post("/api/notifications/:id/mark-read", (req, res) => {
  const { id } = req.params;
  const notification = notifications.find((n) => n.id === parseInt(id));

  if (!notification) {
    return res.status(404).json({
      success: false,
      error: "Notification not found",
    });
  }

  notification.read = true;

  // Broadcast update
  broadcastNotification("NOTIFICATION_UPDATED", {
    notification,
  });

  res.json({
    success: true,
    notification,
  });
});

app.post("/api/notifications/clear", (req, res) => {
  notifications = [];

  // Broadcast clear
  broadcastNotification("NOTIFICATIONS_CLEARED", {
    message: "All notifications cleared",
  });

  res.json({
    success: true,
    message: "All notifications cleared",
  });
});

// Add health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
