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

  // Validate that both dates are valid Date objects
  const expectedDate = expectedTime instanceof Date ? expectedTime : new Date(expectedTime);
  const reachedDate = reachedAt instanceof Date ? reachedAt : new Date(reachedAt);

  if (isNaN(expectedDate.getTime()) || isNaN(reachedDate.getTime())) {
    console.error('[Timing] Invalid date objects:', { expectedTime, reachedAt });
    return null;
  }

  // Log timestamps for debugging (in both UTC and ISO format)
  const expectedUTC = expectedDate.toISOString();
  const reachedUTC = reachedDate.toISOString();
  const expectedLocal = expectedDate.toLocaleString();
  const reachedLocal = reachedDate.toLocaleString();
  
  console.log('[Timing] Calculating timing difference:');
  console.log('  Expected (UTC):', expectedUTC, '| Local:', expectedLocal);
  console.log('  Reached (UTC):', reachedUTC, '| Local:', reachedLocal);

  // Calculate difference in milliseconds
  // getTime() returns milliseconds since epoch (UTC), so this comparison is timezone-independent
  const differenceMs = reachedDate.getTime() - expectedDate.getTime();
  
  // Convert to minutes
  const minutes = Math.round(differenceMs / (1000 * 60));
  
  // Validate difference is reasonable (warn if > 24 hours, likely timezone bug)
  const hoursDifference = Math.abs(minutes) / 60;
  if (hoursDifference > 24) {
    console.warn('[Timing] ⚠️ Unusually large time difference detected:', {
      minutes,
      hours: hoursDifference.toFixed(2),
      expectedUTC,
      reachedUTC,
      message: 'This may indicate a timezone conversion issue'
    });
  }
  
  console.log('[Timing] Difference:', {
    milliseconds: differenceMs,
    minutes,
    hours: (minutes / 60).toFixed(2),
    status: minutes < 0 ? 'early' : minutes > 1 ? 'late' : 'on-time'
  });
  
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

