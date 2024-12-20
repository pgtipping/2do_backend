const Task = require("../models/Task");
const { broadcastNotification } = require("../utils/notifications");
const {
  findRelatedTasks,
  getCategoryDistribution,
  getCommonTaskTimes,
  getPreferredDays,
} = require("../utils/taskPatternAnalysis");

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
      reminder: params.temporal?.reminder,
    });

    broadcastNotification("TASK_CREATED", {
      taskId: task.id,
      message: `New task created: ${task.title}`,
      priority: task.priority,
    });

    return {
      success: true,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        priority_reasoning: task.priority_reasoning,
        due_date: task.due_date,
        start_date: task.start_date,
        recurrence: task.recurrence,
        tags: task.tags,
        dependencies: task.dependencies,
        reminder: task.reminder,
      },
    };
  } catch (error) {
    console.error("Error creating task:", error);
    return { success: false, error: error.message };
  }
}

async function handleUpdateTask(params) {
  try {
    const task = await Task.findByPk(params.id);
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    await task.update({
      title: params.title,
      description: params.description || "",
      priority: params.priority.level,
      priority_reasoning: params.priority.reasoning,
      due_date: params.temporal?.due_date,
      start_date: params.temporal?.start_date,
      recurrence: params.temporal?.recurrence,
      tags: params.tags || [],
      dependencies: params.dependencies || [],
      reminder: params.temporal?.reminder,
    });

    broadcastNotification("TASK_UPDATED", {
      taskId: task.id,
      message: `Task updated: ${task.title}`,
      priority: task.priority,
    });

    return {
      success: true,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        priority_reasoning: task.priority_reasoning,
        due_date: task.due_date,
        start_date: task.start_date,
        recurrence: task.recurrence,
        tags: task.tags,
        dependencies: task.dependencies,
        reminder: task.reminder,
      },
    };
  } catch (error) {
    console.error("Error updating task:", error);
    return { success: false, error: error.message };
  }
}

async function handleAnalyzeTaskContext(params) {
  const { input, tasks = [], currentView = "all" } = params;

  // Find related tasks based on semantic similarity
  const relatedTasks = findRelatedTasks(tasks, input);

  // Get category distribution to suggest categories
  const categoryDistribution = getCategoryDistribution(tasks);
  const suggestedCategories = categoryDistribution
    .slice(0, 3)
    .map((c) => c.category);

  // Check for potential scheduling conflicts
  const potentialConflicts = tasks
    .filter((task) => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      const inputDate = new Date(params.dueDate || Date.now());
      // Check if tasks are on the same day and within 2 hours of each other
      return (
        taskDate.toDateString() === inputDate.toDateString() &&
        Math.abs(taskDate.getTime() - inputDate.getTime()) <= 2 * 60 * 60 * 1000
      );
    })
    .map((task) => ({
      taskId: task.id,
      title: task.title,
      dueDate: task.dueDate,
      conflictType: "scheduling",
    }));

  // Suggest priority based on various factors
  let suggestedPriority = "medium";
  const keywords = {
    high: ["urgent", "asap", "important", "critical", "deadline"],
    low: ["whenever", "someday", "optional", "if possible"],
  };

  const inputLower = input.toLowerCase();
  if (keywords.high.some((word) => inputLower.includes(word))) {
    suggestedPriority = "high";
  } else if (keywords.low.some((word) => inputLower.includes(word))) {
    suggestedPriority = "low";
  }

  // Get common task times for scheduling suggestions
  const commonTimes = getCommonTaskTimes(tasks);
  const preferredDays = getPreferredDays(tasks);

  return {
    related_tasks: relatedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      similarity: task.similarity || "medium",
    })),
    suggested_categories: suggestedCategories,
    potential_conflicts,
    suggested_priority,
    scheduling_insights: {
      common_times: commonTimes,
      preferred_days: preferredDays,
    },
  };
}

async function analyzeDependencies(task, allTasks = []) {
  // Get direct dependencies
  const directDependencies = allTasks.filter((t) =>
    task.dependencies?.includes(t.id)
  );

  // Find indirect dependencies (dependencies of dependencies)
  const indirectDependencies = new Set();
  const visited = new Set();

  function findIndirectDeps(taskId) {
    if (visited.has(taskId)) return;
    visited.add(taskId);

    const task = allTasks.find((t) => t.id === taskId);
    if (!task?.dependencies) return;

    task.dependencies.forEach((depId) => {
      indirectDependencies.add(depId);
      findIndirectDeps(depId);
    });
  }

  task.dependencies?.forEach((depId) => findIndirectDeps(depId));

  // Find potential blockers (incomplete dependencies)
  const potentialBlockers = directDependencies
    .filter((dep) => !dep.completed)
    .map((dep) => ({
      taskId: dep.id,
      title: dep.title,
      dueDate: dep.dueDate,
      reason: "Dependency not completed",
    }));

  // Suggest tasks that could be done in parallel
  // (tasks with similar categories but no dependency relationship)
  const suggestedParallel = allTasks
    .filter((t) => {
      if (t.id === task.id) return false;
      if (task.dependencies?.includes(t.id)) return false;
      if (t.dependencies?.includes(task.id)) return false;
      if (t.completed) return false;

      // Check for category overlap
      const taskCategories = new Set(task.categories || []);
      return (t.categories || []).some((cat) => taskCategories.has(cat));
    })
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      categories: t.categories,
      reason: "Similar category, no dependencies",
    }))
    .slice(0, 3); // Limit to top 3 suggestions

  return {
    direct_dependencies: directDependencies.map((dep) => ({
      taskId: dep.id,
      title: dep.title,
      completed: dep.completed,
    })),
    indirect_dependencies: Array.from(indirectDependencies).map((depId) => {
      const dep = allTasks.find((t) => t.id === depId);
      return {
        taskId: depId,
        title: dep?.title,
        completed: dep?.completed,
      };
    }),
    potential_blockers: potentialBlockers,
    suggested_parallel_tasks: suggestedParallel,
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
