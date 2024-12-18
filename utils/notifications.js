/**
 * Notification types and their handlers
 */
const notificationTypes = {
  TASK_CREATED: "task_created",
  TASK_UPDATED: "task_updated",
  TASK_DELETED: "task_deleted",
  PRIORITY_CHANGED: "priority_changed",
  DEADLINE_APPROACHING: "deadline_approaching",
};

// Store active notification subscribers
const subscribers = new Set();

/**
 * Subscribe to notifications
 * @param {Function} callback - Function to call when notification is received
 * @returns {Function} Unsubscribe function
 */
function subscribeToNotifications(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * Broadcast a notification to all subscribers
 * @param {string} type - Type of notification from notificationTypes
 * @param {Object} data - Notification data
 */
function broadcastNotification(type, data) {
  const notification = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  // Log notification for debugging
  console.log(`Broadcasting notification: ${type}`, data);

  // Notify all subscribers
  subscribers.forEach((callback) => {
    try {
      callback(notification);
    } catch (error) {
      console.error("Error in notification callback:", error);
    }
  });
}

module.exports = {
  notificationTypes,
  subscribeToNotifications,
  broadcastNotification,
};
