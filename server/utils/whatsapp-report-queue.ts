import { TripDataForMessage } from "./send-whatsapp-group";
import { formatWhatsAppReport } from "./format-whatsapp-report";
import { sendWhatsAppToGroup } from "./send-whatsapp-group";

/**
 * Represents a queued trip status change
 */
export interface QueuedTripStatusChange {
  tripData: TripDataForMessage;
  status: "ACTIVE" | "FAILED";
  timestamp: Date;
  statusChangeTime: Date;
}

/**
 * Generate a window key for grouping trips by hour
 * Format: YYYY-MM-DD_HH
 * Example: "2025-12-22_08"
 */
export function generateWindowKey(
  timestamp: Date,
  tripType?: "ARRIVAL" | "DEPARTURE" // No longer used, kept for backward compatibility
): string {
  const timezone = process.env.DISPLAY_TIMEZONE || "Africa/Cairo";

  // Get date components in the specified timezone
  const year = timestamp.toLocaleString("en-US", {
    timeZone: timezone,
    year: "numeric",
  });
  const month = timestamp.toLocaleString("en-US", {
    timeZone: timezone,
    month: "2-digit",
  });
  const day = timestamp.toLocaleString("en-US", {
    timeZone: timezone,
    day: "2-digit",
  });
  const hour = parseInt(
    timestamp.toLocaleString("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    })
  );

  // Return hour-based key: YYYY-MM-DD_HH
  return `${year}-${month}-${day}_${String(hour).padStart(2, "0")}`;
}

/**
 * In-memory queue to store trip status changes
 * Key: windowKey (e.g., "2025-12-22_08")
 * Value: Array of QueuedTripStatusChange
 */
const tripStatusQueue = new Map<string, QueuedTripStatusChange[]>();

/**
 * Queue a trip status change for batching
 * @param tripData Trip data
 * @param status Trip status (ACTIVE or FAILED)
 * @param statusChangeTime Timestamp when status changed
 * @returns The window key where the trip was queued
 */
export async function queueTripStatusChange(
  tripData: TripDataForMessage,
  status: "ACTIVE" | "FAILED",
  statusChangeTime: Date = new Date()
): Promise<string> {
  try {
    // Use scheduledTime instead of statusChangeTime for window grouping
    const scheduledTime = new Date(tripData.scheduledTime);
    const windowKey = generateWindowKey(scheduledTime);

    // Get or create queue for this window
    if (!tripStatusQueue.has(windowKey)) {
      tripStatusQueue.set(windowKey, []);
    }

    const queue = tripStatusQueue.get(windowKey)!;
    queue.push({
      tripData,
      status,
      timestamp: scheduledTime, // Store scheduled time for reference
      statusChangeTime,
    });

    const timezone = process.env.DISPLAY_TIMEZONE || "Africa/Cairo";
    const scheduledHour = parseInt(
      scheduledTime.toLocaleString("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        hour12: false,
      })
    );
    const scheduledMinute = parseInt(
      scheduledTime.toLocaleString("en-US", {
        timeZone: timezone,
        minute: "2-digit",
      })
    );

    console.log(
      `📋 [Queue] Queued ${status} trip "${
        tripData.name
      }" (scheduled: ${scheduledTime.toLocaleString()}, hour: ${scheduledHour}:${String(
        scheduledMinute
      ).padStart(2, "0")}) for window: ${windowKey}`
    );
    console.log(
      `   Window key breakdown: date=${windowKey.split("_")[0]}, hour=${
        windowKey.split("_")[1]
      }, total trips in window: ${queue.length + 1}`
    );

    // Schedule report to be sent at window end time (if not already scheduled)
    scheduleWindowReport(windowKey);

    return windowKey;
  } catch (error: any) {
    console.error(
      `❌ [Queue] Error queueing trip status change:`,
      error.message || error
    );
    throw error;
  }
}

/**
 * Get all queued trips for a specific window
 * @param windowKey Window key
 * @returns Array of queued trip status changes
 */
export function getQueuedTripsForWindow(
  windowKey: string
): QueuedTripStatusChange[] {
  return tripStatusQueue.get(windowKey) || [];
}

/**
 * Clear all trips from a specific window (after processing)
 * @param windowKey Window key
 */
export function clearWindow(windowKey: string): void {
  tripStatusQueue.delete(windowKey);
  console.log(`🗑️ [Queue] Cleared window: ${windowKey}`);
}

/**
 * Get all active window keys
 * @returns Array of window keys
 */
export function getAllWindows(): string[] {
  return Array.from(tripStatusQueue.keys());
}

/**
 * Get window information from a window key
 * @param windowKey Window key (format: YYYY-MM-DD_HH)
 * @returns Object with date and hour
 */
export function parseWindowKey(windowKey: string): {
  date: string;
  hour: number;
} | null {
  const parts = windowKey.split("_");
  if (parts.length !== 2) {
    return null;
  }

  const [date, hourStr] = parts;
  const hour = parseInt(hourStr);

  if (!date || isNaN(hour) || hour < 0 || hour > 23) {
    return null;
  }

  return {
    date,
    hour,
  };
}

/**
 * Track windows that have scheduled reports (to avoid duplicate scheduling)
 */
const scheduledWindows = new Set<string>();

/**
 * Schedule a report to be sent 20 minutes before the next hour
 * For hour 8 (8:00-8:59), send at 8:40 AM
 * @param windowKey Window key
 */
function scheduleWindowReport(windowKey: string): void {
  // Skip if already scheduled
  if (scheduledWindows.has(windowKey)) {
    return;
  }

  const windowInfo = parseWindowKey(windowKey);
  if (!windowInfo) {
    console.warn(
      `⚠️ [Queue] Invalid window key format for scheduling: ${windowKey}`
    );
    return;
  }

  const timezone = process.env.DISPLAY_TIMEZONE || "Africa/Cairo";
  const now = new Date();

  // Parse window hour and date
  const reportHour = windowInfo.hour; // Hour for which we're reporting (e.g., 8 for 8:00-8:59)
  const [year, month, day] = windowInfo.date.split("-").map(Number);

  // Get current time in the specified timezone
  const currentHour = parseInt(
    now.toLocaleString("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    })
  );
  const currentMinute = parseInt(
    now.toLocaleString("en-US", {
      timeZone: timezone,
      minute: "2-digit",
    })
  );

  // Get current date components in the specified timezone
  const currentYear = parseInt(
    now.toLocaleString("en-US", {
      timeZone: timezone,
      year: "numeric",
    })
  );
  const currentMonth = parseInt(
    now.toLocaleString("en-US", {
      timeZone: timezone,
      month: "2-digit",
    })
  );
  const currentDay = parseInt(
    now.toLocaleString("en-US", {
      timeZone: timezone,
      day: "2-digit",
    })
  );

  // Calculate send time: 20 minutes before the next hour
  // For hour 8, send at 8:40 (20 minutes before 9:00)
  const sendHour = reportHour;
  const sendMinute = 40;

  // Check if window is today or in the future
  const isToday =
    year === currentYear && month === currentMonth && day === currentDay;

  let minutesUntilSend: number;
  if (isToday) {
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const sendTimeMinutes = sendHour * 60 + sendMinute;
    minutesUntilSend = sendTimeMinutes - currentTimeMinutes;

    // If send time has already passed today, it will be handled by scheduler
    if (minutesUntilSend < 0) {
      console.log(
        `⏰ [Queue] Window ${windowKey} send time has passed today, will be sent by scheduler`
      );
      scheduledWindows.add(windowKey);
      return;
    }
  } else {
    // Window is in the future - calculate delay including days
    // For simplicity, assume send time is at :40 of the report hour
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const sendTimeMinutes = sendHour * 60 + sendMinute;
    const daysDiff =
      (year - currentYear) * 365 +
      (month - currentMonth) * 30 +
      (day - currentDay);
    minutesUntilSend =
      daysDiff * 24 * 60 + (sendTimeMinutes - currentTimeMinutes);
  }

  // Calculate delay until send time (in milliseconds)
  const delay = minutesUntilSend * 60 * 1000;

  if (delay <= 0) {
    // Send time has already passed - scheduler will handle it
    console.log(
      `⏰ [Queue] Window ${windowKey} send time has passed, will be sent by scheduler`
    );
    scheduledWindows.add(windowKey);
    return;
  }

  // Mark as scheduled
  scheduledWindows.add(windowKey);

  const sendTimeFormatted = `${String(sendHour).padStart(2, "0")}:${String(
    sendMinute
  ).padStart(2, "0")}`;
  console.log(
    `⏰ [Queue] Scheduled report for window ${windowKey} (hour ${reportHour}) to be sent at ${sendTimeFormatted} (in ${Math.round(
      delay / 1000 / 60
    )} minutes)`
  );

  // Schedule the report to be sent 20 minutes before the next hour
  setTimeout(async () => {
    await sendWindowReport(windowKey);
  }, delay);
}

/**
 * Send report for a window
 * @param windowKey Window key
 */
async function sendWindowReport(windowKey: string): Promise<void> {
  try {
    // Remove from scheduled set
    scheduledWindows.delete(windowKey);

    const trips = getQueuedTripsForWindow(windowKey);
    if (trips.length === 0) {
      console.log(`⏭️ [Queue] Window ${windowKey} is empty, skipping`);
      clearWindow(windowKey);
      return;
    }

    const windowInfo = parseWindowKey(windowKey);
    if (!windowInfo) {
      console.warn(`⚠️ [Queue] Invalid window key format: ${windowKey}`);
      return;
    }

    const managersGroupId = process.env.WHATSAPP_MANAGERS_GROUP_ID;
    if (!managersGroupId) {
      console.warn(
        `⚠️ [Queue] WHATSAPP_MANAGERS_GROUP_ID not configured, cannot send report`
      );
      clearWindow(windowKey);
      return;
    }

    // Format and send report
    const report = formatWhatsAppReport(
      trips,
      windowInfo.hour,
      windowInfo.date
    );

    if (!report || report.trim().length === 0) {
      console.warn(`⚠️ [Queue] Empty report generated for window ${windowKey}`);
      clearWindow(windowKey);
      return;
    }

    await sendWhatsAppToGroup({
      groupId: managersGroupId,
      message: report,
    });

    console.log(
      `✅ [Queue] Report sent for window: ${windowKey} (${trips.length} trip${
        trips.length !== 1 ? "s" : ""
      })`
    );

    // Clear processed trips from queue
    clearWindow(windowKey);
  } catch (error: any) {
    console.error(
      `❌ [Queue] Error sending report for window ${windowKey}:`,
      error.message || error
    );
    // Don't clear window on error - let scheduler retry
  }
}
