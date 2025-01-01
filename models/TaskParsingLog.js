const { DataTypes, Model } = require("sequelize");
const crypto = require("crypto");
const sequelize = require("../config/database");
const {
  TASK_PARSING_LOG_FIELDS: FIELDS,
  METRICS_FIELDS,
  METADATA_FIELDS,
} = require("./constants");

// Function to anonymize sensitive data
function anonymizeText(text) {
  // Replace email addresses
  text = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL]"
  );

  // Replace phone numbers
  text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]");

  // Replace names (basic implementation - can be enhanced with NLP)
  const commonNames = ["john", "david", "susan", "mike", "sarah"];
  commonNames.forEach((name) => {
    const regex = new RegExp(`\\b${name}\\b`, "gi");
    text = text.replace(regex, "[NAME]");
  });

  return text;
}

class TaskParsingLog extends Model {
  static async analyzePatterns(timeRange = 24) {
    const cutoff = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    return await sequelize.query(
      `
            SELECT 
                ${FIELDS.PARSING_SUCCESS} as success,
                COUNT(*) as count,
                AVG(CAST(${FIELDS.PARSED_OUTPUT}->>'confidence' AS FLOAT)) as avg_confidence,
                AVG(CAST(${FIELDS.METRICS}->>'${METRICS_FIELDS.PROCESSING_TIME_MS}' AS FLOAT)) as avg_processing_time
            FROM task_parsing_logs
            WHERE timestamp >= :cutoff
            GROUP BY ${FIELDS.PARSING_SUCCESS}
        `,
      {
        replacements: { cutoff },
        type: sequelize.QueryTypes.SELECT,
      }
    );
  }

  getSafeData() {
    const data = this.toJSON();
    delete data[FIELDS.INPUT_HASH];
    return data;
  }
}

TaskParsingLog.init(
  {
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
      validate: {
        hasRequiredMetadata(value) {
          if (value[METADATA_FIELDS.LLM_MODEL]) {
            const validModels = ["gemini-1.5-flash"];
            if (!validModels.includes(value[METADATA_FIELDS.LLM_MODEL])) {
              throw new Error(
                `Invalid LLM model: ${value[METADATA_FIELDS.LLM_MODEL]}`
              );
            }
          }
        },
      },
    },
  },
  {
    sequelize,
    modelName: "task_parsing_log",
    tableName: "task_parsing_logs",
    underscored: true,
    hooks: {
      beforeValidate: async (instance) => {
        if (instance[FIELDS.ANONYMIZED_INPUT]) {
          instance[FIELDS.INPUT_HASH] = crypto
            .createHash("sha256")
            .update(instance[FIELDS.ANONYMIZED_INPUT])
            .digest("hex");

          instance[FIELDS.ANONYMIZED_INPUT] = anonymizeText(
            instance[FIELDS.ANONYMIZED_INPUT]
          );
        }
      },
    },
    indexes: [
      {
        fields: [FIELDS.INPUT_HASH],
      },
      {
        fields: ["timestamp"],
      },
      {
        fields: [FIELDS.PARSING_SUCCESS],
      },
    ],
  }
);

module.exports = TaskParsingLog;
