const Task = require("../models/Task");
const { broadcastNotification } = require("../utils/notifications");

async function handleCreateTask(params) {
  try {
    const task = await Task.create({
      title: params.title,
      description: params.description || "",
      priority: params.priority.level,
      priority_reasoning: params.priority.reasoning,
      due_date: params.temporal?.due_date,
      start_date: params.temporal?.start_date,
      recurrence: params.temporal?.recurrence,
      tags: params.tags || [],
      dependencies: params.dependencies || [],
    });

    broadcastNotification("TASK_CREATED", {
      taskId: task.id,
      message: `New task created: ${task.title}`,
      priority: task.priority,
    });

    return {
      success: true,
      task: {
        ...task.toJSON(),
        priority: {
          level: task.priority,
          reasoning: task.priority_reasoning,
        },
        temporal: {
          due_date: task.due_date,
          start_date: task.start_date,
          recurrence: task.recurrence,
        },
      },
      message: "Task created successfully",
    };
  } catch (error) {
    console.error("Error creating task:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function handleUpdateTask(params) {
  try {
    const task = await Task.findByPk(params.task_id);
    if (!task) {
      return {
        success: false,
        error: "Task not found",
      };
    }

    await task.update(params.updates);

    broadcastNotification("TASK_UPDATED", {
      taskId: task.id,
      message: `Task updated: ${task.title}`,
      reason: params.reason,
      priority: task.priority,
    });

    return {
      success: true,
      task: task,
      message: "Task updated successfully",
    };
  } catch (error) {
    console.error("Error updating task:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function handleAnalyzeTaskContext(params) {
  try {
    const task = await Task.findByPk(params.task_id, {
      include: ["dependencies", "related_tasks"],
    });

    if (!task) {
      return {
        success: false,
        error: "Task not found",
      };
    }

    let analysis = {};
    switch (params.analysis_type) {
      case "priority":
        analysis = await analyzePriority(task);
        break;
      case "scheduling":
        analysis = await analyzeScheduling(task);
        break;
      case "dependencies":
        analysis = await analyzeDependencies(task);
        break;
      case "effort":
        analysis = await analyzeEffort(task);
        break;
      default:
        return {
          success: false,
          error: "Invalid analysis type",
        };
    }

    return {
      success: true,
      analysis: analysis,
    };
  } catch (error) {
    console.error("Error analyzing task:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Analysis helper functions
async function analyzePriority(task) {
  // Implement priority analysis logic
  return {
    current_priority: task.priority,
    reasoning: task.priority_reasoning,
    suggested_changes: null,
    factors_considered: ["due_date", "dependencies", "current_progress"],
  };
}

async function analyzeScheduling(task) {
  // Implement scheduling analysis logic
  return {
    optimal_start_date: task.start_date,
    optimal_due_date: task.due_date,
    conflicts: [],
    scheduling_factors: [
      "dependencies",
      "team_availability",
      "project_timeline",
    ],
  };
}

async function analyzeDependencies(task) {
  // Implement dependency analysis logic
  return {
    direct_dependencies: task.dependencies,
    indirect_dependencies: [],
    potential_blockers: [],
    suggested_parallel_tasks: [],
  };
}

async function analyzeEffort(task) {
  // Implement effort analysis logic
  return {
    estimated_effort: "medium",
    complexity_factors: [],
    resource_requirements: [],
    suggested_breakdown: [],
  };
}

module.exports = {
  handleCreateTask,
  handleUpdateTask,
  handleAnalyzeTaskContext,
};
