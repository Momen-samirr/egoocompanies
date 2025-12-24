import {
  getAllWindows,
  getQueuedTripsForWindow,
  clearWindow,
  parseWindowKey,
} from "../utils/whatsapp-report-queue";
import { formatWhatsAppReport } from "../utils/format-whatsapp-report";
import { sendWhatsAppToGroup } from "../utils/send-whatsapp-group";

/**
 * Background worker that sends batched WhatsApp reports at the end of time windows
 * Runs every 30 seconds to check for windows that have reached their end time
 */
export class WhatsAppReportScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 30000; // 30 seconds - check more frequently for precise timing

  /**
   * Start the background worker
   */
  start() {
    if (this.isRunning) {
      console.log("⚠️ WhatsApp report scheduler is already running");
      return;
    }

    console.log("🚀 Starting WhatsApp report scheduler...");
    this.isRunning = true;

    // Run immediately on start
    this.checkAndSendReports();

    // Then run every interval
    this.intervalId = setInterval(() => {
      this.checkAndSendReports();
    }, this.checkInterval);

    console.log(
      `✅ WhatsApp report scheduler started (checking every ${
        this.checkInterval / 1000
      }s)`
    );
  }

  /**
   * Stop the background worker
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log("🛑 WhatsApp report scheduler stopped");
  }

  /**
   * Check for windows that should send reports (at :40 minutes of each hour)
   */
  private async checkAndSendReports() {
    try {
      const now = new Date();
      const timezone = process.env.DISPLAY_TIMEZONE || "Africa/Cairo";

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

      // Check if we're at or past :40 minutes (20 minutes before the next hour)
      // Send reports for the current hour at :40 (e.g., at 2:40 PM, send report for hour 2:00-2:59)
      // We check >= 40 to handle cases where we might have missed the exact :40 minute
      if (currentMinute >= 40 && currentMinute < 45) {
        // Get all active windows
        const allWindows = getAllWindows();

        if (allWindows.length === 0) {
          return;
        }

        // Find windows for the current hour (e.g., at 2:40 PM, send report for hour 2)
        const reportHour = currentHour;

        console.log(
          `🔍 [Scheduler] Checking for reports: current time=${currentHour}:${String(
            currentMinute
          ).padStart(
            2,
            "0"
          )}, looking for hour ${reportHour}, active windows: ${
            allWindows.length
          }`
        );

        for (const windowKey of allWindows) {
          const windowInfo = parseWindowKey(windowKey);

          if (!windowInfo) {
            console.warn(
              `⚠️ [Scheduler] Invalid window key format: ${windowKey}`
            );
            continue;
          }

          // Send report if this window is for the current hour
          // Only send if we're at :40 (to avoid duplicate sends)
          if (windowInfo.hour === reportHour && currentMinute === 40) {
            console.log(
              `⏰ [Scheduler] Sending report for hour ${reportHour} (${reportHour}:00-${reportHour}:59) at ${currentHour}:${currentMinute}`
            );
            await this.processWindow(windowKey, windowInfo);
          }
        }
      }
    } catch (error: any) {
      console.error("❌ [Scheduler] Error checking for reports:", error);
    }
  }

  /**
   * Process a completed time window and send reports
   */
  private async processWindow(
    windowKey: string,
    windowInfo: {
      date: string;
      hour: number;
    }
  ) {
    try {
      console.log(`📊 [Scheduler] Processing window: ${windowKey}`);

      // Get all trips for this window
      const trips = getQueuedTripsForWindow(windowKey);

      if (trips.length === 0) {
        console.log(`⏭️ [Scheduler] Window ${windowKey} is empty, skipping`);
        clearWindow(windowKey);
        return;
      }

      // Log trip breakdown by status
      const activeCount = trips.filter((t) => t.status === "ACTIVE").length;
      const failedCount = trips.filter((t) => t.status === "FAILED").length;
      console.log(
        `📊 [Scheduler] Window ${windowKey} contains ${trips.length} trip(s): ${activeCount} ACTIVE, ${failedCount} FAILED`
      );

      // Format and send report
      const report = formatWhatsAppReport(
        trips,
        windowInfo.hour,
        windowInfo.date
      );

      if (!report || report.trim().length === 0) {
        console.warn(
          `⚠️ [Scheduler] Empty report generated for window ${windowKey}`
        );
        clearWindow(windowKey);
        return;
      }

      // Send report to WhatsApp group
      const managersGroupId = process.env.WHATSAPP_MANAGERS_GROUP_ID;

      if (!managersGroupId) {
        console.warn(
          `⚠️ [Scheduler] WHATSAPP_MANAGERS_GROUP_ID not configured, skipping report for window ${windowKey}`
        );
        clearWindow(windowKey);
        return;
      }

      await sendWhatsAppToGroup({
        groupId: managersGroupId,
        message: report,
      });

      console.log(
        `✅ [Scheduler] Report sent successfully for window ${windowKey} (${
          trips.length
        } trip${trips.length !== 1 ? "s" : ""})`
      );

      // Clear processed trips from queue
      clearWindow(windowKey);
    } catch (error: any) {
      console.error(
        `❌ [Scheduler] Error processing window ${windowKey}:`,
        error.message || error
      );
      // Don't clear the window on error - let it retry on next check
    }
  }
}

// Export singleton instance
export const whatsappReportScheduler = new WhatsAppReportScheduler();
