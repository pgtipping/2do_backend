const { DataTypes, Model } = require("sequelize");
const crypto = require("crypto");
const sequelize = require("../config/database");

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
                parsing_success as success,
                COUNT(*) as count,
                AVG(CAST(parsed_output->>'confidence' AS FLOAT)) as avg_confidence,
                AVG(CAST(metrics->>'processing_time_ms' AS FLOAT)) as avg_processing_time
            FROM task_parsing_logs
            WHERE timestamp >= :cutoff
            GROUP BY parsing_success
        `,
      {
        replacements: { cutoff },
        type: sequelize.QueryTypes.SELECT,
      }
    );
  }

  getSafeData() {
    const data = this.toJSON();
    delete data.input_hash;
    return data;
  }
}

TaskParsingLog.init(
  {
    // Hash the original input for privacy but maintain traceability
    input_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Store anonymized version of the input
    anonymized_input: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // Parsing results
    parsed_output: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      validate: {
        hasRequiredFields(value) {
          if (!value.task || !value.temporal) {
            throw new Error(
              "parsed_output must contain task and temporal objects"
            );
          }
        },
      },
    },

    // Metadata
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    // Success metrics
    parsing_success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },

    // Error tracking
    errors: {
      type: DataTypes.JSONB,
      defaultValue: null,
    },

    // Performance metrics
    metrics: {
      type: DataTypes.JSONB,
      defaultValue: {},
      validate: {
        hasRequiredMetrics(value) {
          const required = [
            "processing_time_ms",
            "llm_latency_ms",
            "pattern_match_confidence",
          ];
          const missing = required.filter((field) => !(field in value));
          if (missing.length > 0) {
            throw new Error(`Missing required metrics: ${missing.join(", ")}`);
          }
        },
      },
    },

    // Feature flags and versions
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      validate: {
        hasRequiredMetadata(value) {
          const required = ["llm_model", "prompt_version", "pattern_version"];
          const validModels = ["gpt-4o-mini", "gpt-3.5-turbo", "gpt-4-turbo"];
          const missing = required.filter((field) => !(field in value));
          if (missing.length > 0) {
            throw new Error(`Missing required metadata: ${missing.join(", ")}`);
          }
          if (!validModels.includes(value.llm_model)) {
            throw new Error(`Invalid LLM model: ${value.llm_model}`);
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
        // Create a hash of the original input
        if (instance.anonymized_input) {
          instance.input_hash = crypto
            .createHash("sha256")
            .update(instance.anonymized_input)
            .digest("hex");

          // Anonymize the input after creating hash
          instance.anonymized_input = anonymizeText(instance.anonymized_input);
        }
      },
    },
    indexes: [
      {
        fields: ["input_hash"],
      },
      {
        fields: ["timestamp"],
      },
      {
        fields: ["parsing_success"],
      },
    ],
  }
);

module.exports = TaskParsingLog;
