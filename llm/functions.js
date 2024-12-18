const taskFunctions = [
  {
    type: "function",
    name: "create_task",
    description: "Create a new task with complete details",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Task title",
        },
        description: {
          type: "string",
          description: "Detailed task description",
        },
        priority: {
          type: "object",
          properties: {
            level: {
              type: "string",
              enum: ["Low", "Medium", "High", "Critical"],
            },
            reasoning: {
              type: "string",
              description: "Explanation for the priority level",
            },
          },
        },
        temporal: {
          type: "object",
          properties: {
            due_date: {
              type: "string",
              format: "date-time",
              description: "Task due date in user's timezone",
            },
            start_date: {
              type: "string",
              format: "date-time",
              description: "Task start date in user's timezone",
            },
            reminder: {
              type: "string",
              format: "date-time",
              description: "Reminder time in user's timezone",
            },
            recurrence: {
              type: "string",
              description: "Recurrence pattern if any",
            },
          },
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
        },
        dependencies: {
          type: "array",
          items: {
            type: "string",
          },
        },
        categories: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Task categories",
        },
      },
      required: ["title", "priority"],
    },
  },
  {
    type: "function",
    name: "update_task",
    description: "Update an existing task",
    parameters: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "ID of the task to update",
        },
        updates: {
          type: "object",
          description: "Fields to update",
        },
        reason: {
          type: "string",
          description: "Reasoning for the updates",
        },
      },
      required: ["task_id", "updates"],
    },
  },
  {
    type: "function",
    name: "analyze_task_context",
    description: "Analyze task context and provide insights",
    parameters: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
        },
        analysis_type: {
          type: "string",
          enum: ["priority", "scheduling", "dependencies", "effort"],
        },
      },
      required: ["task_id", "analysis_type"],
    },
  },
];

module.exports = {
  taskFunctions,
};
