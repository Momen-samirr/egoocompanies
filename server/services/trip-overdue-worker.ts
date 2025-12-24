import prisma from "../utils/prisma";
import { applyTripFailurePenalty } from "./trip-finance";
import { queueTripStatusChange } from "../utils/whatsapp-report-queue";
import { sendTripStatusToOperations } from "../utils/send-whatsapp-group";

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

    console.log(
      `✅ Trip overdue worker started (checking every ${
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

      console.log(
        `🔍 Checking ${scheduledTrips.length} scheduled trip(s) for overdue status...`
      );

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

            // Apply penalty - don't let errors here block WhatsApp notification
            try {
              await applyTripFailurePenalty(trip.id);
            } catch (penaltyError: any) {
              console.error(
                `⚠️ Error applying trip failure penalty for trip ${trip.id}:`,
                penaltyError.message || penaltyError
              );
              // Continue execution even if penalty fails
            }

            console.log(
              `❌ Trip "${trip.name}" marked as FAILED (overdue and not started)`
            );
            console.log(`   Scheduled time: ${scheduledTime.toISOString()}`);
            console.log(`   Current time: ${now.toISOString()}`);
            if (trip.assignedCaptain) {
              console.log(`   Assigned captain: ${trip.assignedCaptain.name}`);
            }

            // Queue WhatsApp notification for batching
            try {
              const managersGroupId = process.env.WHATSAPP_MANAGERS_GROUP_ID;

              if (!managersGroupId) {
                console.warn(
                  `⚠️ [FAILED] WHATSAPP_MANAGERS_GROUP_ID not configured, skipping WhatsApp notification for trip: ${trip.id}`
                );
              } else {
                // Fetch complete trip data including points
                const tripWithPoints = await prisma.scheduledTrip.findUnique({
                  where: { id: trip.id },
                  include: {
                    points: {
                      orderBy: { order: "asc" },
                    },
                    assignedCaptain: {
                      select: {
                        name: true,
                      },
                    },
                  },
                });

                if (!tripWithPoints) {
                  console.error(
                    `❌ [FAILED] Trip ${trip.id} not found after status update - cannot queue WhatsApp notification`
                  );
                } else {
                  const tripData = {
                    id: tripWithPoints.id,
                    name: tripWithPoints.name,
                    tripType: tripWithPoints.tripType,
                    status: "FAILED" as const,
                    scheduledTime: tripWithPoints.scheduledTime,
                    points: (tripWithPoints.points || []).map((p) => ({
                      name: p.name,
                      order: p.order,
                    })),
                    assignedCaptain: tripWithPoints.assignedCaptain,
                  };

                  // Send immediate notification to Operations group
                  await sendTripStatusToOperations(tripData, "FAILED", now);

                  // Queue trip status change for batched reporting to Managers group
                  const managersGroupId =
                    process.env.WHATSAPP_MANAGERS_GROUP_ID;

                  if (!managersGroupId) {
                    console.warn(
                      `⚠️ [FAILED] WHATSAPP_MANAGERS_GROUP_ID not configured, skipping WhatsApp notification for trip: ${trip.id}`
                    );
                  } else {
                    await queueTripStatusChange(tripData, "FAILED", now);

                    console.log(
                      `📋 [FAILED] WhatsApp notification queued for FAILED trip: ${trip.id}`
                    );
                  }
                }
              }
            } catch (whatsappError: any) {
              // Log error but don't block the FAILED status update
              console.error(
                `❌ [FAILED] Error queueing WhatsApp notification for trip ${trip.id}:`,
                whatsappError.message || whatsappError
              );
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
