/**
 * Utility functions for calculating trip timing differences
 */

export interface TimingResult {
  isEarly: boolean;
  minutes: number;
  status: "on-time" | "early" | "late";
}

/**
 * Calculate the timing difference between expected time and actual reached time
 * @param expectedTime - The expected arrival time for the checkpoint
 * @param reachedAt - The actual time when the checkpoint was reached
 * @returns TimingResult with early/late status and minutes difference
 */
export function calculateTimingDifference(
  expectedTime: Date | null | undefined,
  reachedAt: Date | null | undefined
): TimingResult | null {
  // If no expected time, return null (no timing calculation needed)
  if (!expectedTime) {
    return null;
  }

  // If not reached yet, return null
  if (!reachedAt) {
    return null;
  }

  // Calculate difference in milliseconds
  const differenceMs = reachedAt.getTime() - expectedTime.getTime();
  
  // Convert to minutes
  const minutes = Math.round(differenceMs / (1000 * 60));
  
  // Determine status
  // Consider "on-time" if within 1 minute (early or late)
  const isOnTime = Math.abs(minutes) <= 1;
  
  if (isOnTime) {
    return {
      isEarly: false,
      minutes: 0,
      status: "on-time",
    };
  }
  
  const isEarly = minutes < 0;
  
  return {
    isEarly,
    minutes: Math.abs(minutes),
    status: isEarly ? "early" : "late",
  };
}

/**
 * Format timing message for display
 * @param timing - TimingResult from calculateTimingDifference
 * @returns Formatted message string
 */
export function formatTimingMessage(timing: TimingResult | null): string | null {
  if (!timing) {
    return null;
  }

  if (timing.status === "on-time") {
    return "You arrived on time";
  }

  if (timing.status === "early") {
    return `You arrived ${timing.minutes} minute${timing.minutes !== 1 ? "s" : ""} early`;
  }

  return `You arrived ${timing.minutes} minute${timing.minutes !== 1 ? "s" : ""} late`;
}

