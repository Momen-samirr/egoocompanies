/**
 * Utility functions for week calculations (Sunday-Saturday)
 */

export interface WeekRange {
  start: Date; // Sunday
  end: Date; // Saturday
  label: string; // Formatted as "DD MMM - DD MMM"
}

/**
 * Get the Sunday of the week containing the given date
 */
export function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = d.getDate() - day; // Subtract days to get to Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Saturday of the week containing the given date
 */
export function getSaturdayOfWeek(date: Date): Date {
  const sunday = getSundayOfWeek(date);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);
  return saturday;
}

/**
 * Get the week range (Sunday-Saturday) for a given date
 */
export function getWeekRange(date: Date): WeekRange {
  const start = getSundayOfWeek(date);
  const end = getSaturdayOfWeek(date);
  return {
    start,
    end,
    label: formatWeekRange(start, end),
  };
}

/**
 * Format a week range as "DD MMM - DD MMM"
 */
export function formatWeekRange(start: Date, end: Date): string {
  const startDay = start.getDate();
  const startMonth = start.toLocaleString("en-US", { month: "short" });
  const endDay = end.getDate();
  const endMonth = end.toLocaleString("en-US", { month: "short" });

  if (startMonth === endMonth) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

/**
 * Get the current week range
 */
export function getCurrentWeek(): WeekRange {
  return getWeekRange(new Date());
}

/**
 * Get the previous week range
 */
export function getPreviousWeek(date: Date): WeekRange {
  const prevDate = new Date(date);
  prevDate.setDate(date.getDate() - 7);
  return getWeekRange(prevDate);
}

/**
 * Get the next week range
 */
export function getNextWeek(date: Date): WeekRange {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + 7);
  return getWeekRange(nextDate);
}

/**
 * Generate a list of week ranges for the dropdown
 * Returns weeks from N weeks ago to N weeks in the future
 */
export function generateWeekOptions(
  currentDate: Date = new Date(),
  weeksBefore: number = 10,
  weeksAfter: number = 10
): WeekRange[] {
  const weeks: WeekRange[] = [];
  const startDate = new Date(currentDate);
  startDate.setDate(startDate.getDate() - weeksBefore * 7);

  for (let i = 0; i <= weeksBefore + weeksAfter; i++) {
    const weekDate = new Date(startDate);
    weekDate.setDate(startDate.getDate() + i * 7);
    weeks.push(getWeekRange(weekDate));
  }

  // Sort by date descending (most recent first)
  return weeks.sort((a, b) => b.start.getTime() - a.start.getTime());
}

/**
 * Check if a date falls within a week range
 */
export function isDateInWeekRange(date: Date, weekRange: WeekRange): boolean {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = new Date(weekRange.start);
  start.setHours(0, 0, 0, 0);
  const end = new Date(weekRange.end);
  end.setHours(23, 59, 59, 999);

  return d >= start && d <= end;
}

/**
 * Convert a week range to ISO date strings for API calls
 */
export function weekRangeToDateStrings(weekRange: WeekRange): {
  start: string;
  end: string;
} {
  return {
    start: weekRange.start.toISOString().split("T")[0],
    end: weekRange.end.toISOString().split("T")[0],
  };
}
