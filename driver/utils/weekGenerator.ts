/**
 * Week Generator Utility
 * Provides functions for generating week dates, formatting dates, and comparing dates
 */

/**
 * Get the start of a day (00:00:00.000)
 */
export const getStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get the end of a day (23:59:59.999)
 */
export const getEndOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Check if two dates are on the same day (ignoring time)
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

/**
 * Get the current week (7 days starting from today)
 * Returns an array of Date objects
 */
export const getCurrentWeek = (): Date[] => {
  const today = new Date();
  const weekDates: Date[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    weekDates.push(date);
  }
  
  return weekDates;
};

/**
 * Get the start of the week (today's date at 00:00:00)
 * Used for comparing weeks to detect week changes
 */
export const getWeekStart = (date: Date = new Date()): Date => {
  return getStartOfDay(date);
};

/**
 * Format date for API query parameter (YYYY-MM-DD)
 */
export const formatDateForAPI = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format date for display (Day name and day number)
 * Returns object with { dayName: "Mon", dayNumber: "23" }
 */
export const formatDateDisplay = (date: Date): { dayName: string; dayNumber: string } => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[date.getDay()];
  const dayNumber = String(date.getDate());
  
  return { dayName, dayNumber };
};

/**
 * Parse date string (YYYY-MM-DD) to Date object
 */
export const parseDateFromAPI = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00');
};

/**
 * Check if a date is today
 */
export const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date());
};

