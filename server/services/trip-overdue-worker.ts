import prisma from "../utils/prisma";

/**
 * Background worker that checks for overdue scheduled trips
 * Marks trips as FAILED if scheduled time has passed and trip hasn't been started
 * Runs every 1 minute
 */
export class TripOverdueWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 60000; // 1 minute

  /**
   * Start the background worker
   */
  start() {
    if (this.isRunning) {
      console.log("⚠️ Trip overdue worker is already running");
      return;
    }

    console.log("🚀 Starting trip overdue worker...");
    this.isRunning = true;

    // Run immediately on start
    this.checkOverdueTrips();

    // Then run every interval
    this.intervalId = setInterval(() => {
      this.checkOverdueTrips();
    }, this.checkInterval);

    console.log(`✅ Trip overdue worker started (checking every ${this.checkInterval / 1000}s)`);
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
    console.log("🛑 Trip overdue worker stopped");
  }

  /**
   * Check for overdue trips and mark them as FAILED
   */
  private async checkOverdueTrips() {
    try {
      const now = new Date();

      // Get all scheduled trips that haven't been started yet
      const scheduledTrips = await prisma.scheduledTrip.findMany({
        where: {
          status: "SCHEDULED",
        },
        include: {
          assignedCaptain: {
            select: {
              id: true,
              name: true,
            },
          },
          progress: true,
        },
      });

      if (scheduledTrips.length === 0) {
        return; // No scheduled trips to check
      }

      console.log(`🔍 Checking ${scheduledTrips.length} scheduled trip(s) for overdue status...`);

      for (const trip of scheduledTrips) {
        const scheduledTime = new Date(trip.scheduledTime);

        // Check if scheduled time has passed
        if (now > scheduledTime) {
          // Check if trip has been started (has progress with startedAt)
          const hasStarted = trip.progress && trip.progress.startedAt;

          if (!hasStarted) {
            // Trip is overdue and hasn't been started - mark as FAILED
            await prisma.scheduledTrip.update({
              where: { id: trip.id },
              data: {
                status: "FAILED",
              },
            });

            console.log(`❌ Trip "${trip.name}" marked as FAILED (overdue and not started)`);
            console.log(`   Scheduled time: ${scheduledTime.toISOString()}`);
            console.log(`   Current time: ${now.toISOString()}`);
            if (trip.assignedCaptain) {
              console.log(`   Assigned captain: ${trip.assignedCaptain.name}`);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("❌ Error in trip overdue worker:", error);
    }
  }
}

// Export singleton instance
export const tripOverdueWorker = new TripOverdueWorker();

