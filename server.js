const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");
const Pusher = require("pusher");
const DateTimePatterns = require("./utils/DateTimePatterns");
const DateTimeResolver = require("./utils/DateTimeResolver");
const FeedbackProcessor = require("./utils/FeedbackProcessor");
const TaskParsingLog = require("./models/TaskParsingLog");
const sequelize = require("./config/database");
const { Sequelize } = require("sequelize");
const { encoding_for_model } = require("tiktoken");
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

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize token encoder
const tokenEncoder = encoding_for_model("gpt-4o-2024-08-06");

// Store notifications in memory
let notifications = [];

// Token management functions
function countTokens(text) {
  return tokenEncoder.encode(text).length;
}

function truncateToTokenLimit(text, limit = 500) {
  const tokens = tokenEncoder.encode(text);
  if (tokens.length <= limit) return text;
  return tokenEncoder.decode(tokens.slice(0, limit));
}

// OpenAI API error handler
async function handleOpenAIRequest(requestFn) {
  try {
    return await requestFn();
  } catch (error) {
    if (error.response) {
      console.error("OpenAI API Error:", {
        status: error.response.status,
        data: error.response.data,
      });

      if (error.response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }

      if (error.response.status === 400) {
        throw new Error("Invalid request. Please check your input.");
      }

      throw new Error("OpenAI API error: " + error.response.data.error.message);
    } else {
      console.error("OpenAI Request Error:", error);
      throw new Error("Failed to process your request. Please try again.");
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

    // Create LLM prompt
    const prompt = {
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: SYSTEM_MESSAGE,
        },
        {
          role: "user",
          content: `Create a task from: ${userInput}`,
        },
      ],
      tools: taskFunctions.map((fn) => ({
        type: "function",
        function: {
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        },
      })),
      tool_choice: { type: "function", function: { name: "create_task" } },
    };

    // Get LLM response
    console.log("Getting LLM response...");
    const llmStartTime = Date.now();
    const completion = await openai.chat.completions.create(prompt);
    llmLatency = Date.now() - llmStartTime;

    const response = completion.choices[0];
    console.log("LLM Response:", response);

    if (!response.message.tool_calls) {
      throw new Error("No function call in LLM response");
    }

    // Process function call
    const toolCall = response.message.tool_calls[0];
    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments);

    let taskResult;
    if (functionName === "create_task") {
      taskResult = await handleCreateTask(functionArgs);
    } else {
      throw new Error(`Unexpected function call: ${functionName}`);
    }

    console.log("Task creation result:", taskResult);

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
      analysis: {
        completeness: 1.0,
        missing_info: [],
        suggestions: [],
      },
    });
  } catch (error) {
    console.error("=== Task Parsing Failed ===");
    console.error("Error details:", error);

    res.status(500).json({
      success: false,
      error: error.message,
      feedback: {
        voice: "Sorry, I had trouble with that. Could you try again?",
        display: "Error creating task",
      },
    });
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
