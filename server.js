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
const {
  SYSTEM_MESSAGE,
  CHAT_SYSTEM_MESSAGE,
} = require("./llm/system-messages");
const { taskFunctions } = require("./llm/functions");
const {
  handleCreateTask,
  handleUpdateTask,
  handleAnalyzeTaskContext,
} = require("./llm/handlers");
const Task = require("./models/Task");

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

// Function to format LLM response into conversational text
function formatLLMResponse(response) {
  try {
    // If response is already a string, return it
    if (typeof response === "string") {
      return response;
    }

    // If it's a JSON string, parse it first
    const parsed =
      typeof response === "string" ? JSON.parse(response) : response;
    const task = parsed.task || {};
    const analysis = parsed.analysis || {};
    const questions = parsed.clarifying_questions || [];

    let conversation = [];

    // Add task understanding if available
    if (task.title) {
      conversation.push(
        `I understand you want to ${task.title.toLowerCase()}.`
      );
    }

    // Add task description if available
    if (task.description) {
      conversation.push(`Here's what I've noted: ${task.description}`);
    }

    // Add priority reasoning if available
    if (task.priority?.reasoning) {
      conversation.push(task.priority.reasoning);
    }

    // Add missing information context
    if (analysis.missing_info?.length > 0) {
      conversation.push("\nTo help you better, I have a few questions:");
      analysis.missing_info.forEach((q) => conversation.push(`• ${q}`));
    }

    // Add suggestions if available
    if (analysis.suggestions?.length > 0) {
      conversation.push("\nI have some suggestions:");
      analysis.suggestions.forEach((s) => conversation.push(`• ${s}`));
    }

    // Add clarifying questions
    if (questions.length > 0) {
      if (!analysis.missing_info?.length) {
        // Only add this line if we haven't already added questions
        conversation.push("\nI have a few questions:");
      }
      questions.forEach((q) => conversation.push(`• ${q}`));
    }

    return conversation.join("\n");
  } catch (e) {
    // If anything fails, return the original response or a default message
    return typeof response === "string"
      ? response
      : "I'm here to help with your tasks. What would you like to know?";
  }
}

// Add task parsing endpoint
app.post("/api/parse-task", async (req, res) => {
  console.log("=== Task Processing Started ===");
  const startTime = Date.now();
  let llmLatency = 0;

  try {
    const { userInput, sessionContext = {} } = req.body;

    // Get Gemini response first
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

    const result = await chat.sendMessage(
      `User created task: "${userInput}". Review the task and suggest helpful improvements or ask clarifying questions if needed. Remember to be helpful and conversational, not restrictive.`,
      {
        tools: taskFunctions,
        toolChoice: "auto",
      }
    );

    llmLatency = Date.now() - llmStartTime;
    console.log("Gemini Response:", JSON.stringify(result, null, 2));

    // Parse Gemini response
    let parsedResponse;
    try {
      const responseText = result.response.candidates[0].content.parts[0].text;
      // Clean up JSON markers if present
      const cleanJson = responseText
        .replace(/```json\n/, "")
        .replace(/```/g, "")
        .trim();
      parsedResponse = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError);
      return res.status(500).json({
        success: false,
        error: "Failed to process task",
        feedback: {
          display: "Sorry, I couldn't process that properly. Please try again.",
          voice: "Sorry, I couldn't process that properly. Please try again.",
        },
      });
    }

    // Create task with parsed data
    const taskData = {
      title:
        typeof parsedResponse.task.title === "string"
          ? parsedResponse.task.title
          : userInput,
      description: parsedResponse.task.description || "",
      priority: parsedResponse.task.priority?.level || "Medium",
      priority_reasoning: parsedResponse.task.priority?.reasoning || "",
      status: "TODO",
      metadata: {},
      tags: parsedResponse.task.tags || [],
      categories: [],
      dependencies: parsedResponse.task.dependencies || [],
      due_date: parsedResponse.task.temporal?.due_date || null,
      start_date: parsedResponse.task.temporal?.start_date || null,
      recurrence: parsedResponse.task.temporal?.recurrence || null,
      reminder: parsedResponse.task.temporal?.reminder || null,
    };

    // Create the task
    let createdTask;
    try {
      createdTask = await Task.create(taskData);
      console.log("Task created:", createdTask.id);
    } catch (createError) {
      console.error("Error creating task:", createError);
      return res.status(500).json({
        success: false,
        error: "Failed to create task",
        feedback: {
          display: "Sorry, I couldn't create the task. Please try again.",
          voice: "Sorry, I couldn't create the task. Please try again.",
        },
      });
    }

    // Format conversation response
    const formattedMessage = formatLLMResponse(parsedResponse);

    // Return success response
    return res.json({
      success: true,
      task: createdTask,
      llm_response: {
        message: formattedMessage,
        function_call:
          result.response.candidates[0].content.parts[0].functionCall || null,
      },
      feedback: {
        display: "Task created successfully",
        voice: "I've created your task. " + formattedMessage,
      },
    });
  } catch (error) {
    console.error("=== Task Creation Failed ===");
    console.error("Error details:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create task",
      feedback: {
        display: "Sorry, I couldn't create the task. Please try again.",
        voice: "Sorry, I couldn't create the task. Please try again.",
      },
    });
  }
});

// Add chat endpoint for non-task conversations
app.post("/api/chat", async (req, res) => {
  console.log("=== Chat Processing Started ===");
  const startTime = Date.now();
  let llmLatency = 0;

  try {
    const { userInput, sessionContext = {} } = req.body;

    // Get Gemini response
    console.log("Getting Gemini response...");
    const llmStartTime = Date.now();

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: CHAT_SYSTEM_MESSAGE }],
        },
      ],
    });

    const result = await chat.sendMessage(
      `User message: "${userInput}". Remember to be conversational and natural.`,
      {
        tools: taskFunctions,
        toolChoice: "auto",
      }
    );

    llmLatency = Date.now() - llmStartTime;
    console.log("Gemini Response:", JSON.stringify(result, null, 2));

    // Get the response text and use it directly
    const responseText = result.response.candidates[0].content.parts[0].text;
    const functionCall =
      result.response.candidates[0].content.parts[0].functionCall;

    // Handle function calls if present
    let functionResult = null;
    if (functionCall) {
      try {
        switch (functionCall.name) {
          case "create_task":
            functionResult = await handleCreateTask(functionCall.args);
            break;
          case "update_task":
            functionResult = await handleUpdateTask(functionCall.args);
            break;
          case "analyze_task_context":
            functionResult = await handleAnalyzeTaskContext(functionCall.args);
            break;
          default:
            console.log("Unknown function call:", functionCall.name);
        }
      } catch (error) {
        console.error("Error executing function call:", error);
      }
    }

    // Return success response
    return res.json({
      success: true,
      llm_response: {
        message: responseText,
        function_call: functionCall,
        function_result: functionResult,
      },
      feedback: {
        display: functionResult
          ? getFeedbackMessage(functionCall?.name, functionResult)
          : "Message processed",
        voice: responseText,
      },
    });
  } catch (error) {
    console.error("=== Chat Processing Failed ===");
    console.error("Error details:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to process message",
      feedback: {
        display: "Sorry, I couldn't process your message. Please try again.",
        voice: "Sorry, I couldn't process your message. Please try again.",
      },
    });
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

// Add task CRUD endpoints
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await Task.findAll();
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const task = await Task.create(req.body);
    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    await task.update(req.body);
    res.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    await task.destroy();
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
