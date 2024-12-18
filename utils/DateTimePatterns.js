class DateTimePatterns {
  constructor() {
    this.patternCache = new Map();
    this.patterns = [
      // Basic patterns
      {
        regex: /\b(today|tomorrow|yesterday)\b/i,
        type: "relative_day",
        handler: (match) => ({
          relative_day: match[1].toLowerCase(),
        }),
      },
      // Week patterns
      {
        regex:
          /\b(?:next|last|this|coming)\s+(?:week(?:'s)?(?:\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))?|\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
        type: "relative_week_day",
        handler: (match) => ({
          relative_day: `${
            match[1] ? "next week " + match[1] : "next " + (match[2] || "week")
          }`.toLowerCase(),
        }),
      },
      // End of period patterns
      {
        regex:
          /\b(?:by\s+)?(?:end\s+of)(?:\s+the)?(?:\s+next)?\s+(week|month|year)\b/i,
        type: "relative_week",
        handler: (match) => ({
          relative_period: match[1].toLowerCase().replace(/\s+/g, ""),
          position: "end",
          modifier: "next",
        }),
      },
      // Business day patterns
      {
        regex: /\b(?:by\s+)?(?:end\s+of\s+)?(?:the\s+)?(business\s*day)\b/i,
        type: "day_type",
        handler: (match) => ({
          day_type: match[1].toLowerCase().replace(/\s+/g, ""),
        }),
      },
      // Time patterns
      {
        regex: /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i,
        type: "specific_time",
        handler: (match) => {
          let hours = parseInt(match[1]);
          const minutes = match[2] ? parseInt(match[2]) : 0;
          const meridiem = match[3].toLowerCase().replace(".", "");
          if (meridiem.startsWith("p") && hours < 12) hours += 12;
          if (meridiem.startsWith("a") && hours === 12) hours = 0;
          return {
            time: { hour: hours, minute: minutes },
          };
        },
      },
      // Recurring patterns
      {
        regex:
          /\b(?:weekly\s+)?(?:every|each)\s+(day|morning|evening|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+and\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))?\b/i,
        type: "recurring",
        handler: (match) => ({
          recurrence: {
            frequency: match[1].match(/day|morning|evening/)
              ? "daily"
              : match[1].match(
                  /week|monday|tuesday|wednesday|thursday|friday|saturday|sunday/
                )
              ? "weekly"
              : "monthly",
            day: match[1].match(
              /monday|tuesday|wednesday|thursday|friday|saturday|sunday/
            )
              ? match[1].toLowerCase()
              : null,
            timeContext: match[1].match(/morning|evening/)
              ? match[1].toLowerCase()
              : null,
            additionalDay: match[2] ? match[2].toLowerCase() : null,
          },
        }),
      },
      // Monthly patterns
      {
        regex:
          /\b(?:monthly\s+report\s+on|monthly|every\s+month\s+on)\s+(?:the\s+)?(first|last|1st|2nd|3rd|[4-5]th)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        type: "recurring",
        handler: (match) => ({
          recurrence: {
            frequency: "monthly",
            day: match[2].toLowerCase(),
            position: match[1] ? match[1].toLowerCase() : "last",
          },
        }),
      },
      // Time range patterns
      {
        regex:
          /\b(?:between|from)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|and|-)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
        type: "time_range",
        handler: (match) => {
          const parseTime = (hour, minute, meridiem) => {
            hour = parseInt(hour);
            minute = minute ? parseInt(minute) : 0;
            if (meridiem && meridiem.toLowerCase() === "pm" && hour < 12)
              hour += 12;
            if (meridiem && meridiem.toLowerCase() === "am" && hour === 12)
              hour = 0;
            return { hour, minute };
          };
          return {
            time_range: {
              start: parseTime(match[1], match[2], match[3]),
              end: parseTime(match[4], match[5], match[6]),
            },
          };
        },
      },
      // Special times
      {
        regex: /\b(noon|midnight)\b/i,
        type: "specific_time",
        handler: (match) => ({
          time: {
            hour: match[1].toLowerCase() === "noon" ? 12 : 0,
            minute: 0,
          },
        }),
      },
      // Relative time
      {
        regex: /\bin\s+(\d+)\s+(minute|hour|day|week|month)s?\b/i,
        type: "relative_time",
        handler: (match) => ({
          relative_time: {
            amount: parseInt(match[1]),
            unit: match[2].toLowerCase(),
          },
        }),
      },
      // Day type patterns
      {
        regex: /\b(?:by\s+)?(?:end\s+of\s+)?(weekday|weekend)\b/i,
        type: "day_type",
        handler: (match) => ({
          day_type: match[1].toLowerCase().replace(/\s+/g, ""),
        }),
      },
    ];
  }

  matchPattern(input) {
    if (!input) {
      return [];
    }

    if (this.patternCache.has(input)) {
      return this.patternCache.get(input);
    }

    const matches = [];
    let timeRangeFound = false;

    // First pass: find time ranges
    for (const pattern of this.patterns) {
      if (pattern.type === "time_range") {
        const match = input.match(pattern.regex);
        if (match) {
          timeRangeFound = true;
          matches.push({
            type: pattern.type,
            ...pattern.handler(match),
          });
        }
      }
    }

    // Second pass: find all other patterns except specific_time if time_range was found
    for (const pattern of this.patterns) {
      if (
        pattern.type !== "time_range" &&
        (!timeRangeFound || pattern.type !== "specific_time")
      ) {
        const match = input.match(pattern.regex);
        if (match) {
          // Skip relative_week_day if we have "end of week" pattern
          if (
            pattern.type === "relative_week_day" &&
            input.match(
              /\b(?:by\s+)?(?:end\s+of)(?:\s+the)?(?:\s+next)?\s+week\b/i
            )
          ) {
            continue;
          }
          // Skip relative_week if we have a specific weekday pattern
          if (
            pattern.type === "relative_week" &&
            input.match(
              /\b(?:next|last|this|coming)\s+(?:week\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
            )
          ) {
            continue;
          }
          // Skip relative_week_day if we have a monthly pattern
          if (
            pattern.type === "relative_week_day" &&
            input.match(
              /\b(?:monthly\s+report\s+on|monthly|every\s+month\s+on)\s+(?:the\s+)?(first|last|1st|2nd|3rd|[4-5]th)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
            )
          ) {
            continue;
          }
          matches.push({
            type: pattern.type,
            ...pattern.handler(match),
          });
        }
      }
    }

    this.patternCache.set(input, matches);
    return matches;
  }
}

module.exports = DateTimePatterns;
