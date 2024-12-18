"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Tasks", "reminder", {
      type: Sequelize.DATE,
      allowNull: true,
      after: "completion_date", // Add reminder after completion_date column
    });

    // Add an index on reminder for faster querying of upcoming reminders
    await queryInterface.addIndex("Tasks", ["reminder"], {
      name: "tasks_reminder_index",
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the index first
    await queryInterface.removeIndex("Tasks", "tasks_reminder_index");

    // Then remove the column
    await queryInterface.removeColumn("Tasks", "reminder");
  },
};
