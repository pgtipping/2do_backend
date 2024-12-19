const { DataTypes } = require("sequelize");
const {
  TASK_PARSING_LOG_FIELDS: FIELDS,
  METRICS_FIELDS,
  METADATA_FIELDS,
} = require("../models/constants");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("task_parsing_logs", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      [FIELDS.INPUT_HASH]: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      [FIELDS.ANONYMIZED_INPUT]: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      [FIELDS.PARSED_OUTPUT]: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      [FIELDS.PARSING_SUCCESS]: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      errors: {
        type: DataTypes.JSONB,
        defaultValue: null,
      },
      [FIELDS.METRICS]: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      [FIELDS.METADATA]: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    // Add indexes
    await queryInterface.addIndex("task_parsing_logs", [FIELDS.INPUT_HASH]);
    await queryInterface.addIndex("task_parsing_logs", ["timestamp"]);
    await queryInterface.addIndex("task_parsing_logs", [
      FIELDS.PARSING_SUCCESS,
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("task_parsing_logs");
  },
};
