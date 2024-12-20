const taskFunctions = [
  {
    name: "create_task",
    description:
      "Creates a new task. Use when user wants to add a new task or create something new.",
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
            reminder: {
              type: "string",
              description:
                "Reminder time for the task in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
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
  },
  {
    name: "identify_task",
    description:
      "Finds a specific task the user is referring to. Use when user mentions an existing task or needs to find something.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The user's description or reference to the task",
        },
        context: {
          type: "object",
          properties: {
            current_view: {
              type: "string",
              enum: ["all", "today", "important", "completed"],
              description: "Current view in the UI",
            },
            recent_tasks: {
              type: "array",
              items: {
                type: "string",
              },
              description: "List of recently viewed or modified task IDs",
            },
          },
        },
      },
      required: ["query"],
    },
  },
  {
    name: "update_task",
    description:
      "Modifies an existing task. Use when changes to an existing task are needed, after identifying the task if necessary.",
    parameters: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "ID of the task to update",
        },
        updates: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "New title for the task",
            },
            description: {
              type: "string",
              description: "New description for the task",
            },
            priority: {
              type: "object",
              properties: {
                level: {
                  type: "string",
                  enum: ["Low", "Medium", "High", "Critical"],
                  description: "New priority level",
                },
                reasoning: {
                  type: "string",
                  description: "Explanation for the priority change",
                },
              },
            },
            temporal: {
              type: "object",
              properties: {
                due_date: {
                  type: "string",
                  description: "New due date in ISO format",
                },
                start_date: {
                  type: "string",
                  description: "New start date in ISO format",
                },
                recurrence: {
                  type: "string",
                  description: "New recurrence pattern",
                },
                reminder: {
                  type: "string",
                  description: "New reminder time in ISO format",
                },
              },
            },
            tags: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Updated list of tags",
            },
            dependencies: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Updated list of dependencies",
            },
          },
        },
      },
      required: ["task_id", "updates"],
    },
  },
];

module.exports = { taskFunctions };
