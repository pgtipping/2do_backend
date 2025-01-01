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
    defaultValue: "New Task",
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  priority: {
    type: DataTypes.ENUM("Low", "Medium", "High", "Critical"),
    defaultValue: "Medium",
    allowNull: false,
  },
  priority_reasoning: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("TODO", "IN_PROGRESS", "COMPLETED", "BLOCKED"),
    defaultValue: "TODO",
    allowNull: false,
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
  },
  recurrence: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
    allowNull: false,
  },
  dependencies: {
    type: DataTypes.JSON,
    defaultValue: [],
    allowNull: false,
  },
  categories: {
    type: DataTypes.JSON,
    defaultValue: [],
    allowNull: false,
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    allowNull: false,
  },
  last_modified: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
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
