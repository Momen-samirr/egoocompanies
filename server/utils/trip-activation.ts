import prisma from "./prisma";
import { calculateDistance } from "./haversine";

export interface ActivationCheckResult {
  canActivate: boolean;
  reason?: string;
  distanceToFirstPoint?: number;
  isWithinProximity?: boolean;
  isOnTime?: boolean;
  isWithinTimeWindow?: boolean;
  isTooEarly?: boolean;
  earliestStartTime?: Date;
}

/**
 * Check if a scheduled trip can be activated based on proximity and timing conditions
 * @param tripId The scheduled trip ID
 * @param captainLocation Current location of the captain
 * @returns Activation check result with details
 */
export async function checkTripActivationConditions(
  tripId: string,
  captainLocation: { lat: number; lng: number }
): Promise<ActivationCheckResult> {
  try {
    // Get the scheduled trip with its first checkpoint and captain
    const trip = await prisma.scheduledTrip.findUnique({
      where: { id: tripId },
      include: {
        points: {
          orderBy: { order: "asc" },
          take: 1, // Get only the first checkpoint
        },
        assignedCaptain: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!trip) {
      return {
        canActivate: false,
        reason: "Trip not found",
      };
    }

    if (trip.status !== "SCHEDULED") {
      return {
        canActivate: false,
        reason: `Trip is already ${trip.status.toLowerCase()}`,
      };
    }

    if (!trip.points || trip.points.length === 0) {
      return {
        canActivate: false,
        reason: "Trip has no checkpoints",
      };
    }

    // Security check: Verify captain is assigned
    if (!trip.assignedCaptain) {
      return {
        canActivate: false,
        reason: "This trip has no assigned captain",
        isWithinProximity: false,
        isOnTime: false,
      };
    }

    // Check if captain is online (status must be "active")
    if (trip.assignedCaptain.status !== "active") {
      return {
        canActivate: false,
        reason: "You must be online to start this trip",
        isWithinProximity: false,
        isOnTime: false,
      };
    }

    const firstPoint = trip.points[0];

    // Check proximity (within 5km = 5000 meters)
    const distance = calculateDistance(
      captainLocation.lat,
      captainLocation.lng,
      firstPoint.latitude,
      firstPoint.longitude
    );

    const isWithinProximity = distance <= 5000; // 5km in meters

    // Check timing conditions
    const now = new Date();
    const scheduledDateTime = new Date(trip.scheduledTime);
    
    // Calculate 15 minutes before scheduled time
    const earliestStartTime = new Date(scheduledDateTime);
    earliestStartTime.setMinutes(earliestStartTime.getMinutes() - 15);
    
    // Check if it's too early (before 15-minute window)
    const isTooEarly = now < earliestStartTime;
    
    // Check if it's past the scheduled time
    const isOnTime = now <= scheduledDateTime;
    
    // Check if current time is within the allowed window (15 min before to scheduled time)
    // This combines both: not too early AND not too late
    const isWithinTimeWindow = now >= earliestStartTime && now <= scheduledDateTime;

    // All conditions must be met: proximity AND within time window (which includes on-time check)
    const canActivate = isWithinProximity && isWithinTimeWindow;

    let reason: string | undefined;
    if (!canActivate) {
      if (isTooEarly) {
        const minutesUntilWindow = Math.ceil((earliestStartTime.getTime() - now.getTime()) / (1000 * 60));
        reason = `Too early. You can start this trip ${minutesUntilWindow} minute(s) before the scheduled time (15 minutes before)`;
      } else if (!isWithinProximity && !isOnTime) {
        reason = `You are ${(distance / 1000).toFixed(2)}km away and it's past the scheduled time`;
      } else if (!isWithinProximity) {
        reason = `You are ${(distance / 1000).toFixed(2)}km away (must be within 5km)`;
      } else if (!isOnTime) {
        reason = "It's past the scheduled trip time";
      } else if (!isWithinTimeWindow) {
        reason = "Time window not met";
      }
    }

    // Log activation check
    await prisma.tripActivationCheck.create({
      data: {
        scheduledTripId: tripId,
        captainId: trip.assignedCaptainId,
        wasWithinProximity: isWithinProximity,
        wasOnTime: isWithinTimeWindow, // Time window check (15 min before to scheduled time)
        activated: canActivate,
        captainLatitude: captainLocation.lat,
        captainLongitude: captainLocation.lng,
        distanceToFirstPoint: distance,
      },
    });

    return {
      canActivate,
      reason,
      distanceToFirstPoint: distance,
      isWithinProximity,
      isOnTime,
      isWithinTimeWindow,
      isTooEarly,
      earliestStartTime: earliestStartTime,
    };
  } catch (error: any) {
    console.error("Error checking trip activation conditions:", error);
    return {
      canActivate: false,
      reason: error.message || "Error checking activation conditions",
    };
  }
}

