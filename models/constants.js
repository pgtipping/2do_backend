// Task Parsing Log Fields
const TASK_PARSING_LOG_FIELDS = {
  INPUT: "input",
  ANONYMIZED_INPUT: "anonymized_input",
  INPUT_HASH: "input_hash",
  PARSING_SUCCESS: "parsing_success",
  LLM_LATENCY: "llm_latency",
  TOTAL_LATENCY: "total_latency",
  ERROR_MESSAGE: "error_message",
  PARSED_OUTPUT: "parsed_output",
  METRICS: "metrics",
  METADATA: "metadata",
};

// Metrics Fields
const METRICS_FIELDS = {
  PROCESSING_TIME_MS: "processing_time_ms",
  LLM_LATENCY_MS: "llm_latency_ms",
  PATTERN_MATCH_CONFIDENCE: "pattern_match_confidence",
};

// Metadata Fields
const METADATA_FIELDS = {
  LLM_MODEL: "llm_model",
  PROMPT_VERSION: "prompt_version",
  PATTERN_VERSION: "pattern_version",
};

module.exports = {
  TASK_PARSING_LOG_FIELDS,
  METRICS_FIELDS,
  METADATA_FIELDS,
};
