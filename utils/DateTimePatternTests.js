const DateTimePatterns = require("./DateTimePatterns");
const DateTimeResolver = require("./DateTimeResolver");

class DateTimePatternTests {
  constructor() {
    this.patterns = new DateTimePatterns();
    this.resolver = new DateTimeResolver();
    this.testCases = [
      // Basic date/time patterns
      {
        input: "meeting tomorrow at 3pm",
        expectedPatterns: ["relative_day", "specific_time"],
        description: "Basic tomorrow + time",
      },
      {
        input: "dentist next tuesday at 2:30pm",
        expectedPatterns: ["relative_week_day", "specific_time"],
        description: "Next weekday + specific time",
      },
      {
        input: "call with team in 30 minutes",
        expectedPatterns: ["relative_time"],
        description: "Relative minutes",
      },
      {
        input: "submit report by end of next week",
        expectedPatterns: ["relative_week"],
        description: "End of week",
      },

      // Recurring patterns
      {
        input: "team standup every morning at 9:30am",
        expectedPatterns: ["recurring", "specific_time"],
        description: "Daily recurring meeting",
      },
      {
        input: "weekly review every friday at 4pm",
        expectedPatterns: ["recurring", "specific_time"],
        description: "Weekly recurring meeting",
      },
      {
        input: "monthly report on the last friday",
        expectedPatterns: ["recurring"],
        description: "Monthly recurring task",
      },

      // Time ranges
      {
        input: "available between 2pm and 4pm",
        expectedPatterns: ["time_range"],
        description: "Time range",
      },
      {
        input: "meeting from 10:30am to 11:45am",
        expectedPatterns: ["time_range"],
        description: "Specific time range",
      },

      // Business days
      {
        input: "review code by end of business day",
        expectedPatterns: ["day_type"],
        description: "Business day",
      },
      {
        input: "weekend project planning",
        expectedPatterns: ["day_type"],
        description: "Weekend task",
      },

      // Complex combinations
      {
        input: "team lunch every tuesday and thursday at noon",
        expectedPatterns: ["recurring", "specific_time"],
        description: "Multiple recurring days",
      },
      {
        input: "client meeting next week tuesday between 2pm and 4pm",
        expectedPatterns: ["relative_week_day", "time_range"],
        description: "Next week + time range",
      },

      // Edge cases
      {
        input: "task with no date or time",
        expectedPatterns: [],
        description: "No temporal information",
      },
      {
        input: "meeting at 25:99",
        expectedPatterns: [],
        description: "Invalid time format",
      },
    ];
  }

  async runTests() {
    console.log("Starting DateTime Pattern Tests...\n");
    let passed = 0;
    let failed = 0;
    const startTime = Date.now();

    for (const testCase of this.testCases) {
      console.log(`Testing: ${testCase.description}`);
      console.log(`Input: "${testCase.input}"`);

      try {
        // Test pattern matching
        const matches = this.patterns.matchPattern(testCase.input);
        const matchedTypes = matches.map((m) => m.type);

        // Verify expected patterns
        const missingPatterns = testCase.expectedPatterns.filter(
          (p) => !matchedTypes.includes(p)
        );
        const extraPatterns = matchedTypes.filter(
          (p) => !testCase.expectedPatterns.includes(p)
        );

        if (missingPatterns.length === 0 && extraPatterns.length === 0) {
          console.log("✓ Patterns matched correctly");

          // Test date resolution if patterns exist
          if (matches.length > 0) {
            const resolvedDate = this.resolver.resolveFromPatterns(matches);
            console.log(`Resolved date: ${resolvedDate}`);
          }

          passed++;
        } else {
          console.log("✗ Pattern matching failed");
          if (missingPatterns.length > 0) {
            console.log(`Missing patterns: ${missingPatterns.join(", ")}`);
          }
          if (extraPatterns.length > 0) {
            console.log(`Extra patterns: ${extraPatterns.join(", ")}`);
          }
          failed++;
        }
      } catch (error) {
        console.log(`✗ Test failed with error: ${error.message}`);
        failed++;
      }

      console.log("---\n");
    }

    const duration = Date.now() - startTime;
    console.log("=== Test Summary ===");
    console.log(`Total tests: ${this.testCases.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${duration}ms`);
    console.log(
      `Average time per test: ${(duration / this.testCases.length).toFixed(
        2
      )}ms`
    );
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new DateTimePatternTests();
  tester.runTests().catch(console.error);
}

module.exports = DateTimePatternTests;
