# Field Naming Conventions

## Overview

This document outlines the field naming conventions used in the 2do application, particularly focusing on database fields and their corresponding constants.

## Constants Structure

All field names are defined in `models/constants.js` and are organized into logical groups:

```javascript
const TASK_PARSING_LOG_FIELDS = {
  INPUT: "input",
  ANONYMIZED_INPUT: "anonymized_input",
  // ...
};

const METRICS_FIELDS = {
  PROCESSING_TIME_MS: "processing_time_ms",
  // ...
};

const METADATA_FIELDS = {
  LLM_MODEL: "llm_model",
  // ...
};
```

## Usage Guidelines

1. **Database Fields**

   - Use snake_case for actual database column names
   - Example: `input_hash`, `parsing_success`

2. **Constants**

   - Use UPPER_SNAKE_CASE for constant names
   - Example: `INPUT_HASH`, `PARSING_SUCCESS`

3. **Accessing Fields**
   - Always use computed property syntax with constants
   - Example: `[FIELDS.INPUT_HASH]` instead of `"input_hash"`

## Example Usage

```javascript
// ❌ Wrong
const data = {
  input_hash: "123",
  parsing_success: true,
};

// ✅ Correct
const data = {
  [FIELDS.INPUT_HASH]: "123",
  [FIELDS.PARSING_SUCCESS]: true,
};
```

## Benefits

1. **Type Safety**

   - Constants provide a form of type safety
   - IDE autocomplete support
   - Runtime errors for typos instead of silent failures

2. **Maintainability**

   - Single source of truth for field names
   - Easy to refactor field names
   - Consistent naming across codebase

3. **Documentation**
   - Constants file serves as documentation
   - Field grouping provides context
   - Easy for new developers to understand available fields

## Migration Process

When adding new fields:

1. Add the field name to appropriate constant group in `constants.js`
2. Create a database migration using the constant
3. Update TypeScript interfaces if applicable
4. Add tests for the new field
5. Update documentation if needed

## Validation

The application includes several safety measures:

1. **Database Migrations**

   - Use constants in migrations
   - Ensures consistency between model and database

2. **TypeScript Interfaces**

   - Define field types and structure
   - Provide compile-time type checking

3. **Automated Tests**

   - Validate field presence and types
   - Test field constraints and validations

4. **Model Validation**
   - Runtime validation of required fields
   - Validation of field formats and values
