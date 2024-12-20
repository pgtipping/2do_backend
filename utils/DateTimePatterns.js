class DateTimePatterns {
  constructor() {
    this.patternCache = new Map();
    this.patterns = [
      // Basic patterns
      {
        regex: /\b(today|tomorrow|yesterday)\b/i,
        type: "relative_day",
      },
      // Specific days of the week
      {
        regex:
          /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        type: "specific_day",
      },
      // Specific dates
      {
        regex:
          /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b|\b(\d{1,2})[/-](\d{1,2})\b/i,
        type: "specific_date",
      },
      // Relative times
      {
        regex: /\b(in)\s(\d+)\s(hour|minute)s?\b/i,
        type: "relative_time",
      },
      // Specific times
      {
        regex: /\b(\d{1,2})[:.](\d{2})\s?(am|pm)?\b/i,
        type: "specific_time",
      },
      // Next/Last day of the week
      {
        regex:
          /\b(next|last)\s(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        type: "relative_specific_day",
      },
      // Relative dates with "in"
      {
        regex: /\bin\s(\d+)\s(day|week|month|year)s?\b/i,
        type: "relative_date",
      },
      // This day of the week
      {
        regex:
          /\b(this)\s(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        type: "this_day",
      },
    ];
  }

  extractPatterns(input) {
    if (this.patternCache.has(input)) {
      return this.patternCache.get(input);
    }

    const matches = [];
    for (const pattern of this.patterns) {
      const regex = new RegExp(pattern.regex, "gi");
      let match;
      while ((match = regex.exec(input)) !== null) {
        const extractedMatch = { ...pattern };
        if (pattern.type === "relative_day") {
          extractedMatch.relative_day = match[1].toLowerCase();
        } else if (pattern.type === "specific_day") {
          extractedMatch.day = match[1].toLowerCase();
        } else if (pattern.type === "specific_date") {
          if (match[3]) {
            extractedMatch.day = parseInt(match[1]);
            extractedMatch.month = parseInt(match[2]);
            extractedMatch.year = parseInt(match[3]);
          } else {
            extractedMatch.day = parseInt(match[1]);
            extractedMatch.month = parseInt(match[2]);
          }
        } else if (pattern.type === "relative_time") {
          extractedMatch.amount = parseInt(match[2]);
          extractedMatch.unit = match[3].toLowerCase();
        } else if (pattern.type === "specific_time") {
          extractedMatch.hour = parseInt(match[1]);
          extractedMatch.minute = parseInt(match[2]);
          if (match[3]) {
            extractedMatch.ampm = match[3].toLowerCase();
          }
        } else if (pattern.type === "relative_specific_day") {
          extractedMatch.relative = match[1].toLowerCase();
          extractedMatch.day = match[2].toLowerCase();
        } else if (pattern.type === "relative_date") {
          extractedMatch.amount = parseInt(match[1]);
          extractedMatch.unit = match[2].toLowerCase();
        } else if (pattern.type === "this_day") {
          extractedMatch.day = match[2].toLowerCase();
        }
        matches.push(extractedMatch);
      }
    }

    this.patternCache.set(input, matches);
    return matches;
  }
}

module.exports = DateTimePatterns;
