const TaskParsingLog = require("../models/TaskParsingLog");
const { Op } = require("sequelize");
const {
  TASK_PARSING_LOG_FIELDS: FIELDS,
  METRICS_FIELDS,
  METADATA_FIELDS,
} = require("../models/constants");

class FeedbackProcessor {
  constructor() {
    this.analysisThresholds = {
      minSampleSize: 100,
      errorRateThreshold: 0.2,
      confidenceThreshold: 0.7,
    };
  }

  async analyzeLogs(timeRange = 24) {
    try {
      // Get all logs for the time period
      const logs = await TaskParsingLog.findAll({
        where: {
          timestamp: {
            [Op.gte]: new Date(Date.now() - timeRange * 60 * 60 * 1000),
          },
        },
      });

      // Calculate success and error rates
      const totalLogs = logs.length;
      const successfulLogs = logs.filter(
        (log) => log[FIELDS.PARSING_SUCCESS]
      ).length;
      const successRate = totalLogs > 0 ? successfulLogs / totalLogs : 0;
      const errorRate = 1 - successRate;

      // Get failed logs for detailed analysis
      const failedLogs = logs.filter((log) => !log[FIELDS.PARSING_SUCCESS]);

      // Analyze error patterns
      const errorPatterns = this.analyzeErrorPatterns(failedLogs);

      // Generate insights
      const insights = this.generateInsights({
        errorRate,
        errorPatterns,
        sampleSize: totalLogs,
      });

      // Log analysis results
      console.log("\n=== Feedback Analysis Results ===");
      console.log(`Time Range: Last ${timeRange} hours`);
      console.log(`Sample Size: ${totalLogs} tasks`);
      console.log(`Success Rate: ${(successRate * 100).toFixed(1)}%`);
      console.log("\nTop Error Patterns:");
      Object.entries(errorPatterns)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 5)
        .forEach(([pattern, data]) => {
          console.log(
            `- ${pattern}: ${data.count} occurrences (${(
              (data.count / totalLogs) *
              100
            ).toFixed(1)}%)`
          );
        });
      console.log("\nInsights:", insights);

      // Calculate average confidence for successful tasks
      const avgConfidence =
        logs
          .filter((log) => log[FIELDS.PARSING_SUCCESS])
          .reduce(
            (sum, log) => sum + (log[FIELDS.PARSED_OUTPUT]?.confidence || 0),
            0
          ) / successfulLogs || 0;

      // Return comprehensive analysis
      return {
        timestamp: new Date(),
        metrics: {
          sampleSize: totalLogs,
          successRate,
          errorRate,
          avgConfidence,
        },
        errorPatterns,
        insights,
        recommendations: this.generateRecommendations(insights),
      };
    } catch (error) {
      console.error("Error analyzing logs:", error);
      throw error;
    }
  }

  analyzeErrorPatterns(failedLogs) {
    const patterns = {};

    failedLogs.forEach((log) => {
      // Get plain object from Sequelize model instance
      const logData = log.get({ plain: true });

      // Categorize errors
      const errorType = this.categorizeError(logData.errors);

      if (!patterns[errorType]) {
        patterns[errorType] = {
          count: 0,
          examples: [],
          avgProcessingTime: 0,
        };
      }

      patterns[errorType].count++;
      patterns[errorType].avgProcessingTime +=
        logData[FIELDS.METRICS]?.[METRICS_FIELDS.PROCESSING_TIME_MS] || 0;

      // Keep a few anonymized examples
      if (patterns[errorType].examples.length < 3) {
        patterns[errorType].examples.push(logData[FIELDS.ANONYMIZED_INPUT]);
      }
    });

    // Calculate averages
    Object.values(patterns).forEach((pattern) => {
      pattern.avgProcessingTime /= pattern.count;
    });

    return patterns;
  }

  categorizeError(error) {
    if (!error) return "Unknown Error";

    const errorMsg = typeof error === "string" ? error : error.message;

    // Add error categorization logic
    if (errorMsg.includes("date")) return "Date Parsing Error";
    if (errorMsg.includes("time")) return "Time Parsing Error";
    if (errorMsg.includes("format")) return "Format Error";
    if (errorMsg.includes("invalid")) return "Invalid Input";

    return "Other Error";
  }

  generateInsights(data) {
    const insights = [];

    // Sample size check
    if (data.sampleSize < this.analysisThresholds.minSampleSize) {
      insights.push({
        type: "warning",
        message:
          "Small sample size - results may not be statistically significant",
      });
    }

    // Error rate analysis
    if (data.errorRate > this.analysisThresholds.errorRateThreshold) {
      insights.push({
        type: "critical",
        message: "High error rate detected",
        details: `${(data.errorRate * 100).toFixed(
          1
        )}% of requests are failing`,
      });
    }

    // Pattern-specific insights
    Object.entries(data.errorPatterns).forEach(([pattern, info]) => {
      if (info.count > data.sampleSize * 0.1) {
        insights.push({
          type: "pattern",
          message: `Frequent error pattern: ${pattern}`,
          details: `${
            info.count
          } occurrences, avg processing time: ${info.avgProcessingTime.toFixed(
            0
          )}ms`,
        });
      }
    });

    return insights;
  }

  generateRecommendations(insights) {
    const recommendations = [];

    insights.forEach((insight) => {
      switch (insight.type) {
        case "critical":
          recommendations.push({
            priority: "high",
            action: "Review and update parsing patterns",
            details:
              "High error rate indicates need for immediate pattern refinement",
          });
          break;

        case "pattern":
          recommendations.push({
            priority: "medium",
            action: "Add new pattern recognition rule",
            details: `Consider adding specific handling for: ${insight.message}`,
          });
          break;

        case "warning":
          recommendations.push({
            priority: "low",
            action: "Collect more data",
            details: "Continue monitoring to establish reliable patterns",
          });
          break;
      }
    });

    return recommendations;
  }

  startScheduledAnalysis(interval = 24) {
    // Run initial analysis
    this.analyzeLogs(interval).catch(console.error);

    // Schedule regular analysis
    setInterval(() => {
      this.analyzeLogs(interval).catch(console.error);
    }, interval * 60 * 60 * 1000); // Convert hours to milliseconds
  }
}

module.exports = FeedbackProcessor;
