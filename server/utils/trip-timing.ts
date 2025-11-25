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
  let expectedDate = expectedTime instanceof Date ? expectedTime : new Date(expectedTime);
  const reachedDate = reachedAt instanceof Date ? reachedAt : new Date(reachedAt);

  if (isNaN(expectedDate.getTime()) || isNaN(reachedDate.getTime())) {
    console.error('[Timing] Invalid date objects:', { expectedTime, reachedAt });
    return null;
  }

  // FIX: Handle timezone mismatch for existing trips stored with old format
  // Old trips stored expectedTime as UTC (with "Z"), but user entered local time
  // Strategy: If the difference is unreasonably large and negative (showing early when should be late),
  // try adjusting expectedTime by the server's timezone offset
  const initialDifferenceMs = reachedDate.getTime() - expectedDate.getTime();
  const initialMinutes = Math.round(initialDifferenceMs / (1000 * 60));
  const initialHours = Math.abs(initialMinutes) / 60;
  
  // Detect timezone bug: if showing "early" by > 1 hour, it's likely a timezone issue
  // This indicates expectedTime was stored in wrong timezone (likely UTC when it should be local)
  // We check if adjusting by server timezone offset makes the result more reasonable
  if (initialMinutes < -60) {
    // getTimezoneOffset() returns offset in minutes (negative for timezones ahead of UTC)
    // Example: UTC+2 returns -120, UTC-5 returns 300
    // If expectedTime was stored as UTC but should be local time:
    //   - User entered: 10:30 PM local (UTC+2) = 8:30 PM UTC
    //   - Stored as: 10:30 PM UTC (wrong - 2 hours ahead)
    //   - To fix: subtract 2 hours (7200000 ms) from stored value
    const serverOffsetMinutes = new Date().getTimezoneOffset(); // Returns -120 for UTC+2
    // Convert to positive milliseconds for subtraction (we always subtract to go back in time)
    const correctionMs = Math.abs(serverOffsetMinutes) * 60 * 1000;
    
    // Adjust expectedTime: subtract the correction to convert from UTC to local-equivalent UTC
    // This corrects the timezone mismatch (stored UTC -> correct UTC)
    const adjustedExpectedDate = new Date(expectedDate.getTime() - correctionMs);
    const adjustedDifferenceMs = reachedDate.getTime() - adjustedExpectedDate.getTime();
    const adjustedMinutes = Math.round(adjustedDifferenceMs / (1000 * 60));
    
    // If adjusted difference is reasonable (between -60 and +120 minutes), use it
    if (adjustedMinutes >= -60 && adjustedMinutes <= 120) {
      console.warn('[Timing] ⚠️ Detected timezone mismatch in expectedTime, applying correction');
      console.warn('  Original expectedTime (UTC):', expectedDate.toISOString());
      console.warn('  Adjusted expectedTime (corrected):', adjustedExpectedDate.toISOString());
      console.warn('  Original diff:', initialMinutes, 'minutes | Adjusted diff:', adjustedMinutes, 'minutes');
      expectedDate = adjustedExpectedDate;
    }
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

