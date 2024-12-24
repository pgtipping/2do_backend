/**
 * Backend implementation of task pattern analysis utilities
 */

const { Op } = require("sequelize");
const Task = require("../models/Task");

/**
 * Find tasks that might be related to the input
 * @param {Array} tasks - All tasks to analyze
 * @param {string} input - User input text
 * @returns {Array} Related tasks
 */
async function findRelatedTasks(tasks, input) {
  if (!input || !tasks?.length) return [];

  const words = input
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3);
  if (!words.length) return [];

  return tasks
    .filter((task) => {
      const taskText = `${task.title} ${task.description || ""}`.toLowerCase();
      return words.some((word) => taskText.includes(word));
    })
    .slice(-3); // Last 3 related tasks
}

/**
 * Get category distribution of tasks
 * @param {Array} tasks - Array of tasks to analyze
 * @returns {Array} Category distribution with counts and percentages
 */
async function getCategoryDistribution(tasks) {
  if (!tasks?.length) return [];

  const categoryMap = new Map();

  tasks.forEach((task) => {
    const categories = task.tags || []; // Using tags as categories
    categories.forEach((category) => {
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });
  });

  return Array.from(categoryMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / tasks.length) * 100),
    }));
}

/**
 * Extract common times when tasks are scheduled
 * @param {Array} tasks - Array of tasks to analyze
 * @returns {Array} Common times with their frequency
 */
async function getCommonTaskTimes(tasks) {
  if (!tasks?.length) return [];

  const timeMap = new Map();

  tasks.forEach((task) => {
    if (task.due_date) {
      const time = new Date(task.due_date).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      timeMap.set(time, (timeMap.get(time) || 0) + 1);
    }
  });

  return Array.from(timeMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3) // Top 3 most common times
    .map(([time, count]) => ({
      time,
      frequency: count,
      percentage: Math.round((count / tasks.length) * 100),
    }));
}

/**
 * Analyze which days of the week are preferred for tasks
 * @param {Array} tasks - Array of tasks to analyze
 * @returns {Array} Preferred days with their frequency
 */
async function getPreferredDays(tasks) {
  if (!tasks?.length) return [];

  const dayMap = new Map();
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  tasks.forEach((task) => {
    if (task.due_date) {
      const day = daysOfWeek[new Date(task.due_date).getDay()];
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    }
  });

  return Array.from(dayMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([day, count]) => ({
      day,
      frequency: count,
      percentage: Math.round((count / tasks.length) * 100),
    }));
}

module.exports = {
  findRelatedTasks,
  getCategoryDistribution,
  getCommonTaskTimes,
  getPreferredDays,
};
