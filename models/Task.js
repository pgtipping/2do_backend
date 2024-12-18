const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Task = sequelize.define("Task", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  priority: {
    type: DataTypes.ENUM("Low", "Medium", "High", "Critical"),
    defaultValue: "Medium",
  },
  priority_reasoning: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("TODO", "IN_PROGRESS", "COMPLETED", "BLOCKED"),
    defaultValue: "TODO",
  },
  due_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completion_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reminder: {
    type: DataTypes.DATE,
    allowNull: true,
    description: "Reminder time in user's timezone",
  },
  recurrence: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  dependencies: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  categories: {
    type: DataTypes.JSON,
    defaultValue: [],
    description: "Task categories",
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  last_modified: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

// Add hooks
Task.beforeUpdate(async (task) => {
  task.last_modified = new Date();
});

// Add associations
Task.associate = (models) => {
  Task.belongsToMany(models.Task, {
    as: "dependencies",
    through: "TaskDependencies",
    foreignKey: "taskId",
    otherKey: "dependencyId",
  });

  Task.belongsToMany(models.Task, {
    as: "related_tasks",
    through: "RelatedTasks",
    foreignKey: "taskId",
    otherKey: "relatedTaskId",
  });
};

module.exports = Task;
