import prisma from "../utils/prisma";
import { checkTripActivationConditions } from "../utils/trip-activation";
import { sendTripActivationNotification } from "../utils/send-notification";

/**
 * Background worker that checks scheduled trips for activation
 * Runs every 30 seconds to check if captains are within range and on time
 */
export class TripActivationWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 30000; // 30 seconds

  /**
   * Start the background worker
   */
  start() {
    if (this.isRunning) {
      console.log("⚠️ Trip activation worker is already running");
      return;
    }

    console.log("🚀 Starting trip activation worker...");
    this.isRunning = true;

    // Run immediately on start
    this.checkTrips();

    // Then run every interval
    this.intervalId = setInterval(() => {
      this.checkTrips();
    }, this.checkInterval);

    console.log(`✅ Trip activation worker started (checking every ${this.checkInterval / 1000}s)`);
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
    console.log("🛑 Trip activation worker stopped");
  }

  /**
   * Check all scheduled trips for activation conditions
   */
  private async checkTrips() {
    try {
      // Get all scheduled trips that haven't been activated yet
      const scheduledTrips = await prisma.scheduledTrip.findMany({
        where: {
          status: "SCHEDULED",
        },
        include: {
          assignedCaptain: {
            select: {
              id: true,
              name: true,
              notificationToken: true,
            },
          },
          points: {
            orderBy: { order: "asc" },
            take: 1, // Only need first checkpoint
          },
          progress: true,
        },
      });

      if (scheduledTrips.length === 0) {
        return; // No scheduled trips to check
      }

      console.log(`🔍 Checking ${scheduledTrips.length} scheduled trip(s) for activation...`);

      for (const trip of scheduledTrips) {
        // Skip if no points
        if (!trip.points || trip.points.length === 0) {
          continue;
        }

        // Skip trips without an assigned captain
        if (!trip.assignedCaptain) {
          continue;
        }

        // Check if captain is online - only check activation if captain is online
        if (trip.assignedCaptain.status !== "active") {
          continue; // Skip this trip if captain is offline
        }

        // Get captain's last known location
        let captainLocation: { lat: number; lng: number } | null = null;

        if (trip.progress && trip.progress.lastLatitude && trip.progress.lastLongitude) {
          captainLocation = {
            lat: trip.progress.lastLatitude,
            lng: trip.progress.lastLongitude,
          };
        } else {
          // No location available yet, skip this trip
          continue;
        }

        // Check if notification was already sent for this trip
        // We check if there's already an activation check with activated: true
        // created within the last 24 hours (to handle trips that remain schedulable for a while)
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);
        
        const existingActivationCheck = await prisma.tripActivationCheck.findFirst({
          where: {
            scheduledTripId: trip.id,
            activated: true, // Conditions were met
            createdAt: {
              gte: oneDayAgo, // Within last 24 hours
            },
          },
          orderBy: {
            createdAt: 'desc', // Get the most recent one
          },
        });

        // If notification was already sent recently, skip sending notification again
        // We still check conditions to log them, but don't send duplicate notifications
        let shouldSkipNotification = false;
        if (existingActivationCheck) {
          const timeSinceLastCheck = Date.now() - existingActivationCheck.createdAt.getTime();
          const minutesAgo = Math.floor(timeSinceLastCheck / (1000 * 60));
          console.log(`⏭️ Trip "${trip.name}" - activation already checked ${minutesAgo} minute(s) ago`);
          console.log(`   Skipping duplicate notification (will still check conditions for logging)`);
          shouldSkipNotification = true;
        }

        // Check activation conditions (always check for logging purposes)
        const result = await checkTripActivationConditions(trip.id, captainLocation);

        if (result.canActivate) {
          console.log(`✅ Trip "${trip.name}" can be activated!`);
          console.log(`   Captain: ${trip.assignedCaptain.name}`);
          console.log(`   Distance: ${result.distanceToFirstPoint ? (result.distanceToFirstPoint / 1000).toFixed(2) : 'N/A'}km`);

          // Only send notification if it wasn't sent recently
          if (!shouldSkipNotification) {
            // Send notification to captain (only once)
            if (trip.assignedCaptain.notificationToken) {
              const notificationResult = await sendTripActivationNotification(trip.assignedCaptain.id, trip.id);
              
              if (notificationResult.success) {
                console.log(`   📱 Notification sent to captain (first time)`);
              } else {
                console.error(`   ❌ Failed to send notification: ${notificationResult.message}`);
              }
            } else {
              console.log(`   ⚠️ Captain has no notification token`);
            }
          } else {
            console.log(`   ⏭️ Skipping notification - already sent recently`);
          }
        }
      }
    } catch (error: any) {
      console.error("❌ Error in trip activation worker:", error);
    }
  }
}

// Export singleton instance
export const tripActivationWorker = new TripActivationWorker();

