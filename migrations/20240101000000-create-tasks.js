"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Tasks", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "New Task",
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      priority: {
        type: Sequelize.ENUM("Low", "Medium", "High", "Critical"),
        defaultValue: "Medium",
        allowNull: false,
      },
      priority_reasoning: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("PENDING", "COMPLETED"),
        defaultValue: "PENDING",
        allowNull: false,
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completion_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      reminder: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      recurrence: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tags: {
        type: Sequelize.JSON,
        defaultValue: [],
        allowNull: false,
      },
      dependencies: {
        type: Sequelize.JSON,
        defaultValue: [],
        allowNull: false,
      },
      categories: {
        type: Sequelize.JSON,
        defaultValue: [],
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: false,
      },
      last_modified: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Tasks");
  },
};
