class DateTimeResolver {
  constructor() {
    this.dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
  }

  resolveFromPatterns(input, patterns) {
    if (!patterns || patterns.length === 0) {
      return null;
    }

    let date = new Date();
    let hasDate = false;
    let hasTime = false;

    for (const pattern of patterns) {
      if (pattern.type === "relative_day") {
        hasDate = true;
        if (pattern.relative_day === "tomorrow") {
          date.setDate(date.getDate() + 1);
        } else if (pattern.relative_day === "yesterday") {
          date.setDate(date.getDate() - 1);
        }
      } else if (pattern.type === "specific_day") {
        hasDate = true;
        const dayIndex = this.dayNames.indexOf(pattern.day);
        if (dayIndex !== -1) {
          const dayDiff = (dayIndex - date.getDay() + 7) % 7;
          date.setDate(date.getDate() + dayDiff);
        }
      } else if (pattern.type === "specific_date") {
        hasDate = true;
        date.setFullYear(pattern.year);
        date.setMonth(pattern.month - 1);
        date.setDate(pattern.day);
      } else if (pattern.type === "relative_time") {
        hasTime = true;
        if (pattern.unit === "hour") {
          date.setHours(date.getHours() + pattern.amount);
        } else if (pattern.unit === "minute") {
          date.setMinutes(date.getMinutes() + pattern.amount);
        }
      } else if (pattern.type === "specific_time") {
        hasTime = true;
        date.setHours(pattern.hour);
        date.setMinutes(pattern.minute || 0);
        if (pattern.ampm === "pm" && pattern.hour < 12) {
          date.setHours(date.getHours() + 12);
        }
        if (pattern.ampm === "am" && pattern.hour === 12) {
          date.setHours(0);
        }
      } else if (pattern.type === "relative_specific_day") {
        hasDate = true;
        const dayIndex = this.dayNames.indexOf(pattern.day);
        if (dayIndex !== -1) {
          let dayDiff = (dayIndex - date.getDay() + 7) % 7;
          if (pattern.relative === "next") {
            dayDiff += 7;
          } else if (pattern.relative === "last") {
            dayDiff -= 7;
          }
          date.setDate(date.getDate() + dayDiff);
        }
      } else if (pattern.type === "relative_date") {
        hasDate = true;
        if (pattern.unit === "day") {
          date.setDate(date.getDate() + pattern.amount);
        } else if (pattern.unit === "week") {
          date.setDate(date.getDate() + pattern.amount * 7);
        } else if (pattern.unit === "month") {
          date.setMonth(date.getMonth() + pattern.amount);
        } else if (pattern.unit === "year") {
          date.setFullYear(date.getFullYear() + pattern.amount);
        }
      } else if (pattern.type === "this_day") {
        hasDate = true;
        const dayIndex = this.dayNames.indexOf(pattern.day);
        if (dayIndex !== -1) {
          const dayDiff = (dayIndex - date.getDay() + 7) % 7;
          date.setDate(date.getDate() + dayDiff);
        }
      }
    }

    // Default time to end of day if only date specified
    if (hasDate && !hasTime) {
      date.setHours(23, 59, 59, 999);
    }

    return date.toISOString();
  }
}

module.exports = DateTimeResolver;
