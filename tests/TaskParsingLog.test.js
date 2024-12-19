const { expect } = require("chai");
const TaskParsingLog = require("../models/TaskParsingLog");
const {
  TASK_PARSING_LOG_FIELDS: FIELDS,
  METRICS_FIELDS,
  METADATA_FIELDS,
} = require("../models/constants");

describe("TaskParsingLog Model", () => {
  // Test data
  const validTaskData = {
    [FIELDS.INPUT_HASH]: "123hash456",
    [FIELDS.ANONYMIZED_INPUT]: "meeting tomorrow at 3pm",
    [FIELDS.PARSED_OUTPUT]: {
      task: {
        title: "meeting",
        description: "Meeting scheduled for tomorrow at 3:00 PM",
        priority: {
          level: "Medium",
          reasoning: "Default priority assigned",
        },
      },
      temporal: {
        date_type: "relative",
        parsed_date: "2024-01-02T15:00:00.000Z",
        confidence: 0.95,
        alternatives: [],
        error: null,
      },
    },
    [FIELDS.PARSING_SUCCESS]: true,
    [FIELDS.METRICS]: {
      [METRICS_FIELDS.PROCESSING_TIME_MS]: 1000,
      [METRICS_FIELDS.LLM_LATENCY_MS]: 800,
      [METRICS_FIELDS.PATTERN_MATCH_CONFIDENCE]: 0.95,
    },
    [FIELDS.METADATA]: {
      [METADATA_FIELDS.LLM_MODEL]: "gemini-1.5-flash",
      [METADATA_FIELDS.PROMPT_VERSION]: "1.0",
      [METADATA_FIELDS.PATTERN_VERSION]: "1.0",
    },
  };

  describe("Field Validation", () => {
    it("should create a valid task parsing log", async () => {
      const log = await TaskParsingLog.create(validTaskData);
      expect(log).to.be.an("object");
      expect(log[FIELDS.INPUT_HASH]).to.equal(validTaskData[FIELDS.INPUT_HASH]);
      expect(log[FIELDS.PARSING_SUCCESS]).to.be.true;
    });

    it("should require input_hash", async () => {
      try {
        const invalidData = { ...validTaskData };
        delete invalidData[FIELDS.INPUT_HASH];
        await TaskParsingLog.create(invalidData);
        throw new Error("Should not reach here");
      } catch (error) {
        expect(error.name).to.equal("SequelizeValidationError");
      }
    });

    it("should require anonymized_input", async () => {
      try {
        const invalidData = { ...validTaskData };
        delete invalidData[FIELDS.ANONYMIZED_INPUT];
        await TaskParsingLog.create(invalidData);
        throw new Error("Should not reach here");
      } catch (error) {
        expect(error.name).to.equal("SequelizeValidationError");
      }
    });

    it("should validate metrics fields", async () => {
      try {
        const invalidData = {
          ...validTaskData,
          [FIELDS.METRICS]: {
            invalid_metric: 123,
          },
        };
        await TaskParsingLog.create(invalidData);
        throw new Error("Should not reach here");
      } catch (error) {
        expect(error.name).to.equal("SequelizeValidationError");
      }
    });

    it("should validate metadata fields", async () => {
      try {
        const invalidData = {
          ...validTaskData,
          [FIELDS.METADATA]: {
            [METADATA_FIELDS.LLM_MODEL]: "invalid-model",
          },
        };
        await TaskParsingLog.create(invalidData);
        throw new Error("Should not reach here");
      } catch (error) {
        expect(error.name).to.equal("SequelizeValidationError");
      }
    });
  });

  describe("Model Methods", () => {
    beforeEach(async () => {
      await TaskParsingLog.destroy({ where: {}, force: true });
      await TaskParsingLog.create(validTaskData);
    });

    it("should analyze patterns correctly", async () => {
      const patterns = await TaskParsingLog.analyzePatterns(24);
      expect(patterns).to.be.an("array");
      expect(patterns[0]).to.have.property("success");
      expect(patterns[0]).to.have.property("count");
      expect(patterns[0]).to.have.property("avg_confidence");
    });

    it("should get safe data without input_hash", async () => {
      const log = await TaskParsingLog.findOne();
      const safeData = log.getSafeData();
      expect(safeData).to.not.have.property(FIELDS.INPUT_HASH);
    });
  });

  describe("Hooks", () => {
    it("should anonymize input before save", async () => {
      const sensitiveData = {
        ...validTaskData,
        [FIELDS.ANONYMIZED_INPUT]:
          "meeting with john@email.com at 123-456-7890",
      };
      const log = await TaskParsingLog.create(sensitiveData);
      expect(log[FIELDS.ANONYMIZED_INPUT]).to.include("[EMAIL]");
      expect(log[FIELDS.ANONYMIZED_INPUT]).to.include("[PHONE]");
    });

    it("should generate input_hash before save", async () => {
      const log = await TaskParsingLog.create(validTaskData);
      expect(log[FIELDS.INPUT_HASH]).to.be.a("string");
      expect(log[FIELDS.INPUT_HASH]).to.have.lengthOf(64); // SHA-256 hash length
    });
  });
});
