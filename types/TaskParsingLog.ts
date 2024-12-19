import {
  TASK_PARSING_LOG_FIELDS,
  METRICS_FIELDS,
  METADATA_FIELDS,
} from "../models/constants";

// Create type literals from the constants
type MetricsFieldKeys = (typeof METRICS_FIELDS)[keyof typeof METRICS_FIELDS];
type MetadataFieldKeys = (typeof METADATA_FIELDS)[keyof typeof METADATA_FIELDS];
type TaskParsingLogFieldKeys =
  (typeof TASK_PARSING_LOG_FIELDS)[keyof typeof TASK_PARSING_LOG_FIELDS];

export interface TaskPriority {
  level: "Low" | "Medium" | "High" | "Critical";
  reasoning: string;
}

export interface TaskTemporal {
  due_date?: string;
  start_date?: string;
  recurrence?: string;
}

export interface TaskData {
  title: string;
  description: string;
  priority: TaskPriority;
  temporal: TaskTemporal;
  tags?: string[];
  dependencies?: string[];
}

export interface ParsedOutput {
  task: TaskData;
  temporal: {
    date_type: string | null;
    parsed_date: string | null;
    confidence: number;
    alternatives: Array<{
      date: string;
      reason: string;
    }>;
    error: string | null;
  };
}

export interface TaskMetrics extends Record<MetricsFieldKeys, number> {}

export interface TaskMetadata extends Record<MetadataFieldKeys, string> {}

export interface TaskError {
  message: string;
  type: string;
  stack?: string;
}

export interface TaskParsingLogAttributes {
  id?: number;
  input_hash: string;
  anonymized_input: string;
  parsed_output: ParsedOutput;
  timestamp: Date;
  parsing_success: boolean;
  errors?: TaskError | null;
  metrics: TaskMetrics;
  metadata: TaskMetadata;
  created_at?: Date;
  updated_at?: Date;
}

export interface TaskParsingLogCreationAttributes
  extends Omit<TaskParsingLogAttributes, "id"> {}

// Helper type to map constant values to interface keys
type ConstantToInterfaceMap = {
  [K in TaskParsingLogFieldKeys]: K extends (typeof TASK_PARSING_LOG_FIELDS)[keyof typeof TASK_PARSING_LOG_FIELDS]
    ? keyof TaskParsingLogAttributes
    : never;
};

// Verify that all constant values map to interface keys
type VerifyFieldNames = {
  [K in keyof ConstantToInterfaceMap]: ConstantToInterfaceMap[K];
};

// This will cause a compile error if field names don't match
const _typeCheck: VerifyFieldNames = {
  input: "input_hash",
  anonymized_input: "anonymized_input",
  parsed_output: "parsed_output",
  parsing_success: "parsing_success",
  metrics: "metrics",
  metadata: "metadata",
} as const;
