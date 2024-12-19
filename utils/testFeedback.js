const TaskParsingLog = require("../models/TaskParsingLog");
const FeedbackProcessor = require("./FeedbackProcessor");
const DateTimeResolver = require("./DateTimeResolver");
const { OpenAI } = require("openai");
const crypto = require("crypto");
const {
  TASK_PARSING_LOG_FIELDS: FIELDS,
  METRICS_FIELDS,
  METADATA_FIELDS,
} = require("../models/constants");
require("dotenv").config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to generate hash
const generateHash = (text) => {
  return crypto.createHash("sha256").update(text).digest("hex");
};

// Process a single task
async function processTask(input) {
  const startTime = Date.now();
  let llmLatency = 0;

  try {
    // LLM Processing
    const llmStartTime = Date.now();
    console.log("\nProcessing task:", input);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a task parser specializing in temporal expressions. Parse natural language into structured JSON data.

Example input: "meeting tomorrow at 3pm"
Example JSON output:
{
  "task": {
    "title": "meeting",
    "description": "Meeting scheduled for tomorrow at 3:00 PM",
    "priority": "medium"
  },
  "temporal": {
    "date_type": "relative",
    "parsed_date": "2024-12-07T15:00:00.000Z",
    "confidence": 0.95,
    "alternatives": [],
    "error": null
  }
}

Example input: "submit report by end of next week"
Example JSON output:
{
  "task": {
    "title": "submit report",
    "description": "Report due by end of next week",
    "priority": "medium"
  },
  "temporal": {
    "date_type": "relative",
    "parsed_date": "2024-12-13T23:59:59.000Z",
    "confidence": 0.9,
    "alternatives": [
      {
        "date": "2024-12-15T23:59:59.000Z",
        "reason": "You can also pick Sunday if you prefer"
      }
    ],
    "error": null
  }
}

Example input: "xyz123"
Example JSON output:
{
  "task": {
    "title": "Unknown task",
    "description": "I couldn't understand when this needs to be done",
    "priority": "medium"
  },
  "temporal": {
    "date_type": null,
    "parsed_date": null,
    "confidence": 0,
    "alternatives": [],
    "error": "Oops! I need a time or date to add this task. Try something like 'tomorrow' or '3pm'"
  }
}

Example input: "meeting next blurday at noon"
Example JSON output:
{
  "task": {
    "title": "meeting",
    "description": "Meeting at noon next blurday",
    "priority": "medium"
  },
  "temporal": {
    "date_type": "relative",
    "parsed_date": "2024-12-07T12:00:00.000Z",
    "confidence": 0.95,
    "alternatives": [],
    "error": "I don't know what day 'blurday' is. Did you mean Monday, Tuesday, Wednesday...?"
  }
}

Example input: "meeting at 25:99"
Example JSON output:
{
  "task": {
    "title": "meeting",
    "description": "Meeting time needs to be fixed",
    "priority": "medium"
  },
  "temporal": {
    "date_type": null,
    "parsed_date": null,
    "confidence": 0,
    "alternatives": [],
    "error": "That time doesn't look right. Try something like '3:30pm' or '14:30'"
  }
}`,
        },
        {
          role: "user",
          content: `Parse this task into JSON: "${input}"
Use the current date (${new Date().toISOString()}) as reference for relative dates.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    llmLatency = Date.now() - llmStartTime;
    const llmResult = JSON.parse(completion.choices[0].message.content);
    console.log("\nLLM Response:", JSON.stringify(llmResult, null, 2));

    // Validate LLM response format
    if (!llmResult.task || !llmResult.temporal) {
      console.log("Invalid LLM response format");
      throw new Error("Invalid response format from LLM");
    }

    // If LLM detected an error, return it
    if (llmResult.temporal.error) {
      console.log("LLM detected error:", llmResult.temporal.error);
      return {
        success: false,
        parsed_output: llmResult,
        error: llmResult.temporal.error,
        processing_time: Date.now() - startTime,
        llm_latency: llmLatency,
      };
    }

    // Resolve the date
    const resolver = new DateTimeResolver();
    const resolvedDate = resolver.resolve(llmResult.temporal);
    console.log("\nResolved date:", JSON.stringify(resolvedDate, null, 2));

    const success = !resolvedDate.error && resolvedDate.date !== null;
    console.log("\nSuccess:", success);
    console.log("Error:", resolvedDate.error);

    return {
      success,
      parsed_output: {
        task: llmResult.task,
        temporal: {
          ...llmResult.temporal,
          resolved_date: resolvedDate.date,
          confidence: resolvedDate.confidence,
        },
      },
      error: resolvedDate.error,
      processing_time: Date.now() - startTime,
      llm_latency: llmLatency,
    };
  } catch (error) {
    console.error("\nError processing task:", error);
    return {
      success: false,
      parsed_output: null,
      error: error.message,
      processing_time: Date.now() - startTime,
      llm_latency: llmLatency,
    };
  }
}

// Sample data generator
const generateSampleData = async () => {
  const sampleInputs = [
    "meeting with John tomorrow at 3pm",
    "dentist appointment on January 15th at 2:30pm",
    "invalid date format xyz123",
    "meeting next blurday at noon",
    "call with team in 30 minutes",
    "submit report by end of next week",
    "coffee at quarter to midnight",
    "invalid time format 25:99",
  ];

  console.log("Generating sample data...");

  try {
    // Clear existing data
    await TaskParsingLog.destroy({ where: {}, force: true });
    console.log("Cleared existing data");

    // Process each sample input
    for (const input of sampleInputs) {
      const result = await processTask(input);

      const taskData = {
        [FIELDS.INPUT_HASH]: generateHash(input),
        [FIELDS.ANONYMIZED_INPUT]: input,
        [FIELDS.PARSED_OUTPUT]: result.parsed_output || {
          task: { title: null, description: null, priority: "medium" },
          temporal: { error: result.error },
        },
        [FIELDS.PARSING_SUCCESS]: result.success,
        errors: !result.success
          ? { message: result.error, type: "ParseError" }
          : null,
        [FIELDS.METRICS]: {
          [METRICS_FIELDS.PROCESSING_TIME_MS]: result.processing_time,
          [METRICS_FIELDS.LLM_LATENCY_MS]: result.llm_latency,
          [METRICS_FIELDS.PATTERN_MATCH_CONFIDENCE]: result.success ? 0.9 : 0.3,
        },
        [FIELDS.METADATA]: {
          [METADATA_FIELDS.LLM_MODEL]: "gemini-1.5-flash ",
          [METADATA_FIELDS.PROMPT_VERSION]: "1.0",
          [METADATA_FIELDS.PATTERN_VERSION]: "1.0",
        },
      };

      await TaskParsingLog.create(taskData);
      console.log(`Created log for: ${input}`);
    }

    console.log("Sample data generated successfully");

    // Test the feedback processor
    console.log("\nTesting feedback processor...");
    const feedbackProcessor = new FeedbackProcessor();
    const analysis = await feedbackProcessor.analyzeLogs(24);

    console.log("\nAnalysis Results:");
    console.log(JSON.stringify(analysis, null, 2));
  } catch (error) {
    console.error("Error generating sample data:", error);
    if (error.errors) {
      error.errors.forEach((err) => {
        console.error("Validation error:", {
          field: err.path,
          message: err.message,
          value: err.value,
        });
      });
    }
    throw error;
  }
};

// Run the test if this file is executed directly
if (require.main === module) {
  generateSampleData()
    .then(() => {
      console.log("Test completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}

module.exports = { generateSampleData };
