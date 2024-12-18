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

  resolveFromPatterns(patterns) {
    const date = new Date();
    let hasTime = false;
    let hasDate = false;

    patterns.forEach((pattern) => {
      switch (pattern.type) {
        case "relative_day":
          if (pattern.relative_day === "tomorrow") {
            date.setDate(date.getDate() + 1);
          } else if (pattern.relative_day === "yesterday") {
            date.setDate(date.getDate() - 1);
          }
          hasDate = true;
          break;

        case "relative_week_day":
          const dayParts = pattern.relative_day.split(" ");
          const targetDay = this.dayNames.indexOf(
            dayParts[dayParts.length - 1]
          );
          const currentDay = date.getDay();
          let daysToAdd = targetDay - currentDay;

          if (dayParts.includes("next")) {
            if (dayParts.includes("week")) {
              daysToAdd += 7;
            } else if (daysToAdd <= 0) {
              daysToAdd += 7;
            }
          }

          date.setDate(date.getDate() + daysToAdd);
          hasDate = true;
          break;

        case "relative_week":
          if (pattern.relative_period === "week") {
            // Move to end of current week (Friday)
            const daysToFriday = 5 - date.getDay();
            if (daysToFriday > 0) {
              date.setDate(date.getDate() + daysToFriday);
            }
            date.setHours(17, 0, 0, 0); // 5 PM
            hasTime = true;
            hasDate = true;
          } else if (pattern.relative_period === "businessday") {
            date.setHours(17, 0, 0, 0); // 5 PM
            hasTime = true;
          }
          break;

        case "specific_time":
          if (pattern.time) {
            date.setHours(pattern.time.hour, pattern.time.minute, 0, 0);
            hasTime = true;
          }
          break;

        case "time_range":
          if (pattern.time_range) {
            date.setHours(
              pattern.time_range.start.hour,
              pattern.time_range.start.minute,
              0,
              0
            );
            hasTime = true;
          }
          break;

        case "recurring":
          if (pattern.recurrence) {
            const rec = pattern.recurrence;
            if (rec.frequency === "daily") {
              if (!hasDate) date.setDate(date.getDate() + 1);
            } else if (rec.frequency === "weekly" && rec.day) {
              const targetDay = this.dayNames.indexOf(rec.day);
              let daysToAdd = targetDay - date.getDay();
              if (daysToAdd <= 0) daysToAdd += 7;
              date.setDate(date.getDate() + daysToAdd);
            }
            if (rec.timeContext === "morning") {
              date.setHours(9, 0, 0, 0);
              hasTime = true;
            } else if (rec.timeContext === "evening") {
              date.setHours(18, 0, 0, 0);
              hasTime = true;
            }
          }
          break;

        case "day_type":
          if (pattern.day_type === "weekend") {
            // Move to Saturday if not already weekend
            const currentDay = date.getDay();
            if (currentDay < 6) {
              // If not Saturday or Sunday
              const daysToSaturday = 6 - currentDay;
              date.setDate(date.getDate() + daysToSaturday);
            }
            hasDate = true;
          } else if (
            pattern.day_type === "weekday" ||
            pattern.day_type === "businessday"
          ) {
            // If current day is weekend, move to next Monday
            const currentDay = date.getDay();
            if (currentDay === 0) {
              // Sunday
              date.setDate(date.getDate() + 1);
            } else if (currentDay === 6) {
              // Saturday
              date.setDate(date.getDate() + 2);
            }
            hasDate = true;
          }
          break;

        case "relative_time":
          if (pattern.relative_time) {
            const { amount, unit } = pattern.relative_time;
            switch (unit) {
              case "minute":
                date.setMinutes(date.getMinutes() + amount);
                hasTime = true;
                break;
              case "hour":
                date.setHours(date.getHours() + amount);
                hasTime = true;
                break;
              case "day":
                date.setDate(date.getDate() + amount);
                hasDate = true;
                break;
              case "week":
                date.setDate(date.getDate() + amount * 7);
                hasDate = true;
                break;
              case "month":
                date.setMonth(date.getMonth() + amount);
                hasDate = true;
                break;
            }
          }
          break;
      }
    });

    // Default time to end of day if only date specified
    if (hasDate && !hasTime) {
      date.setHours(23, 59, 59, 999);
    }

    return date.toISOString();
  }
}

module.exports = DateTimeResolver;
