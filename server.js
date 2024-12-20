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
  console.log("=== Task Processing Started ===");
  const startTime = Date.now();
  let llmLatency = 0;
  let error = null;
  let parsedResponse = null;

  try {
    const { userInput, sessionContext = {} } = req.body;

    // Validate input
    if (!userInput || typeof userInput !== "string") {
      console.error("Invalid input:", userInput);
      return res.status(400).json({
        success: false,
        error: "Invalid input text",
        feedback: {
          voice:
            "I need some text to process your request. Could you try again?",
          display: "Please provide input text",
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

    const result = await chat.sendMessage(userInput, {
      tools: taskFunctions,
      toolChoice: "auto", // Let the LLM choose the appropriate function
    });

    llmLatency = Date.now() - llmStartTime;
    console.log("Gemini Response:", JSON.stringify(result, null, 2));

    const candidate = result.response.candidates[0];
    if (!candidate.content.parts[0].functionCall) {
      throw new Error("Expected function call in response");
    }

    const functionCall = candidate.content.parts[0].functionCall;
    console.log(`LLM chose function: ${functionCall.name}`);

    // Process based on the chosen function
    let taskResult;
    switch (functionCall.name) {
      case "create_task":
        taskResult = await handleCreateTask(functionCall.args);
        break;
      case "identify_task":
        taskResult = await handleIdentifyTask({
          ...functionCall.args,
          context: { ...functionCall.args.context, ...sessionContext },
        });
        break;
      case "update_task":
        taskResult = await handleUpdateTask(functionCall.args);
        break;
      default:
        throw new Error(`Unknown function: ${functionCall.name}`);
    }

    // Send appropriate response based on the function called
    const response = {
      success: true,
      function_called: functionCall.name,
      result: taskResult,
      feedback: {
        voice: getFeedbackMessage(functionCall.name, taskResult),
        display: getDisplayMessage(functionCall.name, taskResult),
      },
    };

    // Broadcast notification if needed
    if (["create_task", "update_task"].includes(functionCall.name)) {
      broadcastNotification(
        `TASK_${functionCall.name === "create_task" ? "CREATED" : "UPDATED"}`,
        {
          taskId: taskResult.task.id,
          message: `Task ${
            functionCall.name === "create_task" ? "created" : "updated"
          }: ${taskResult.task.title}`,
          task: taskResult.task,
        }
      );
    }

    res.json(response);
  } catch (err) {
    error = err;
    console.error("=== Task Processing Failed ===");
    console.error("Error details:", err);

    res.status(500).json({
      success: false,
      error: err.message,
      feedback: {
        voice:
          "I encountered an error processing your request. Please try again.",
        display: "Error processing request",
      },
    });
  } finally {
    // Log processing attempt
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
              function_called: parsedResponse?.functionCall?.name,
              args: parsedResponse?.functionCall?.args,
              result: parsedResponse?.result,
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
      console.error("Failed to log processing attempt:", logError);
    }
  }
});

// Helper functions for feedback messages
function getFeedbackMessage(functionName, result) {
  switch (functionName) {
    case "create_task":
      return `I've created a task: ${result.task.title}`;
    case "identify_task":
      return result.success
        ? `I found the task: ${result.task.title}`
        : "I couldn't find that task. Could you be more specific?";
    case "update_task":
      return `I've updated the task: ${result.task.title}`;
    default:
      return "Request processed successfully";
  }
}

function getDisplayMessage(functionName, result) {
  switch (functionName) {
    case "create_task":
      return "Task created successfully";
    case "identify_task":
      return result.success ? "Task found" : "Task not found";
    case "update_task":
      return "Task updated successfully";
    default:
      return "Request processed";
  }
}

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
