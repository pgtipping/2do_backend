/**
 * Notification types and their handlers
 */
const notificationTypes = {
  TASK_CREATED: "TASK_CREATED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_DELETED: "TASK_DELETED",
  PRIORITY_CHANGED: "PRIORITY_CHANGED",
  DEADLINE_APPROACHING: "DEADLINE_APPROACHING",
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
  console.log("Broadcasting notification:", { type, data });
  const notification = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

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
