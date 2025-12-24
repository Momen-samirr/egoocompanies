import { QueuedTripStatusChange } from "./whatsapp-report-queue";

/**
 * Format batched trips into an organized WhatsApp report
 * @param trips Array of queued trip status changes
 * @param hour Hour number (0-23) for which we're reporting
 * @param date Date string (e.g., "2025-12-22")
 * @returns Formatted WhatsApp report message
 */
export function formatWhatsAppReport(
  trips: QueuedTripStatusChange[],
  hour: number,
  date: string
): string {
  if (trips.length === 0) {
    return "";
  }

  const timezone = process.env.DISPLAY_TIMEZONE || "Africa/Cairo";
  
  // Format date for display
  const dateObj = new Date(date);
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Format hour range for display (e.g., "8:00 AM - 8:59 AM")
  const formatHourStart = (h: number): string => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:00 ${ampm}`;
  };

  const formatHourEnd = (h: number): string => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:59 ${ampm}`;
  };

  const hourStartFormatted = formatHourStart(hour);
  const hourEndFormatted = formatHourEnd(hour);

  // Separate trips by status
  const activeTrips = trips.filter((t) => t.status === "ACTIVE");
  const failedTrips = trips.filter((t) => t.status === "FAILED");

  // Calculate summary statistics
  const total = trips.length;
  const onTrack = activeTrips.length;
  const offTrack = failedTrips.length;

  // Build report header
  let report = `📊 *Trip Report - ${hourStartFormatted} - ${hourEndFormatted} Hour*\n`;
  report += `📅 Date: ${formattedDate}\n\n`;

  // Summary section
  report += `📈 *Summary:*\n`;
  report += `• Total: ${total} trip${total !== 1 ? "s" : ""}\n`;
  report += `• ✅ On Track: ${onTrack} trip${onTrack !== 1 ? "s" : ""} (ACTIVE)\n`;
  report += `• ❌ Off Track: ${offTrack} trip${offTrack !== 1 ? "s" : ""} (FAILED)\n\n`;

  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // ACTIVE trips section
  if (activeTrips.length > 0) {
    report += `✅ *ACTIVE TRIPS (${activeTrips.length})*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    activeTrips.forEach((queuedTrip, index) => {
      const trip = queuedTrip.tripData;
      const points = trip.points || [];
      const firstPoint = points[0];
      const lastPoint = points[points.length - 1];
      const driverName = trip.assignedCaptain?.name || "Not Assigned";

      // Format scheduled time
      const scheduledTime = new Date(trip.scheduledTime);
      const formattedScheduledTime = scheduledTime.toLocaleString("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // Format status change time
      const formattedStatusChangeTime = queuedTrip.statusChangeTime.toLocaleString(
        "en-US",
        {
          timeZone: timezone,
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }
      );

      // Check if on time (within 5 minutes of scheduled time)
      const timeDiff = Math.abs(
        scheduledTime.getTime() - queuedTrip.statusChangeTime.getTime()
      );
      const minutesDiff = timeDiff / (1000 * 60);
      const onTimeStatus = minutesDiff <= 5 ? "✅ On Time" : "⚠️ Late";

      // Get trip type label
      const tripTypeLabel =
        trip.tripType === "ARRIVAL" ? "🛬 ARRIVAL" : "🛫 DEPARTURE";

      report += `🚗 *Trip:* ${trip.name} (${tripTypeLabel})\n`;
      report += `   Driver: ${driverName}\n`;
      report += `   Scheduled: ${formattedScheduledTime}\n`;
      report += `   Start: ${firstPoint?.name || "N/A"} → End: ${lastPoint?.name || "N/A"}\n`;
      report += `   Checkpoints: ${points.length}\n`;
      report += `   Status: Started at ${formattedStatusChangeTime} ${onTimeStatus}\n`;
      report += `   Trip ID: ${trip.id}\n`;

      if (index < activeTrips.length - 1) {
        report += `\n`;
      }
    });

    report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  // FAILED trips section
  if (failedTrips.length > 0) {
    report += `❌ *FAILED TRIPS (${failedTrips.length})*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    failedTrips.forEach((queuedTrip, index) => {
      const trip = queuedTrip.tripData;
      const points = trip.points || [];
      const firstPoint = points[0];
      const lastPoint = points[points.length - 1];
      const driverName = trip.assignedCaptain?.name || "Not Assigned";

      // Format scheduled time
      const scheduledTime = new Date(trip.scheduledTime);
      const formattedScheduledTime = scheduledTime.toLocaleString("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // Format status change time
      const formattedStatusChangeTime = queuedTrip.statusChangeTime.toLocaleString(
        "en-US",
        {
          timeZone: timezone,
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }
      );

      // Get trip type label
      const tripTypeLabel =
        trip.tripType === "ARRIVAL" ? "🛬 ARRIVAL" : "🛫 DEPARTURE";

      report += `❌ *Trip:* ${trip.name} (${tripTypeLabel})\n`;
      report += `   Driver: ${driverName}\n`;
      report += `   Scheduled: ${formattedScheduledTime}\n`;
      report += `   Start: ${firstPoint?.name || "N/A"} → End: ${lastPoint?.name || "N/A"}\n`;
      report += `   Checkpoints: ${points.length}\n`;
      report += `   Failed at: ${formattedStatusChangeTime}\n`;
      report += `   Trip ID: ${trip.id}\n`;

      if (index < failedTrips.length - 1) {
        report += `\n`;
      }
    });

    report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  // Footer
  const now = new Date();
  const formattedNow = now.toLocaleString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  report += `Report generated at: ${formattedNow}`;

  return report;
}

