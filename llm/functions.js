const taskFunctions = {
  name: "create_task",
  description: "Creates a new task with the specified details",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "The title/name of the task",
      },
      description: {
        type: "string",
        description: "Detailed description of what the task involves",
      },
      priority: {
        type: "object",
        properties: {
          level: {
            type: "string",
            enum: ["Low", "Medium", "High", "Critical"],
            description: "Priority level of the task",
          },
          reasoning: {
            type: "string",
            description: "Explanation for why this priority level was chosen",
          },
        },
        required: ["level", "reasoning"],
      },
      temporal: {
        type: "object",
        properties: {
          due_date: {
            type: "string",
            description:
              "Due date for the task in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
          },
          start_date: {
            type: "string",
            description:
              "Start date for the task in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
          },
          recurrence: {
            type: "string",
            description:
              "Recurrence pattern for the task (e.g., 'daily', 'weekly', 'monthly')",
          },
        },
      },
      tags: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of tags associated with the task",
      },
      dependencies: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of task IDs that this task depends on",
      },
    },
    required: ["title", "description", "priority"],
  },
};

module.exports = { taskFunctions };
