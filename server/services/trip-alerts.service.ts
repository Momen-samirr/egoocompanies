import prisma from "../utils/prisma";

export enum AlertType {
  ROUTE_DEVIATION = "ROUTE_DEVIATION",
  LONG_IDLE_TIME = "LONG_IDLE_TIME",
  SPEED_VIOLATION = "SPEED_VIOLATION",
  CHECKPOINT_DELAY = "CHECKPOINT_DELAY",
  LOCATION_UPDATE_FAILURE = "LOCATION_UPDATE_FAILURE",
}

export enum AlertSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface TripAlert {
  tripId: string;
  driverId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata?: {
    distanceFromRoute?: number;
    idleDuration?: number;
    speed?: number;
    checkpointIndex?: number;
    expectedTime?: Date;
    actualTime?: Date;
    lastUpdateTime?: Date;
  };
  timestamp: Date;
}

interface AlertConfig {
  routeDeviationThreshold: number; // meters, default 100
  idleTimeThreshold: number; // minutes, default 5
  speedLimit?: number; // km/h, optional
  locationUpdateTimeout: number; // minutes, default 2
}

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  routeDeviationThreshold: 100, // 100 meters
  idleTimeThreshold: 5, // 5 minutes
  locationUpdateTimeout: 2, // 2 minutes
};

/**
 * Check conditions and generate alerts for a trip location update
 */
export async function checkAndSendAlerts(
  tripId: string,
  locationData: {
    driverId: string;
    latitude: number;
    longitude: number;
    speed?: number;
    distanceFromRoute?: number;
    isIdle?: boolean;
    timestamp: Date;
  },
  config: Partial<AlertConfig> = {}
): Promise<TripAlert[]> {
  const alertConfig = { ...DEFAULT_ALERT_CONFIG, ...config };
  const alerts: TripAlert[] = [];

  // Get trip information
  const trip = await prisma.scheduledTrip.findUnique({
    where: { id: tripId },
    include: {
      progress: true,
      points: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!trip || trip.status !== "ACTIVE") {
    return alerts; // Only check alerts for active trips
  }

  // 1. Check route deviation
  if (
    locationData.distanceFromRoute !== undefined &&
    locationData.distanceFromRoute > alertConfig.routeDeviationThreshold
  ) {
    const severity =
      locationData.distanceFromRoute > 500
        ? AlertSeverity.HIGH
        : locationData.distanceFromRoute > 200
        ? AlertSeverity.MEDIUM
        : AlertSeverity.LOW;

    alerts.push({
      tripId,
      driverId: locationData.driverId,
      alertType: AlertType.ROUTE_DEVIATION,
      severity,
      message: `Driver deviated ${(
        locationData.distanceFromRoute / 1000
      ).toFixed(2)} km from planned route`,
      metadata: {
        distanceFromRoute: locationData.distanceFromRoute,
      },
      timestamp: locationData.timestamp,
    });
  }

  // 2. Check idle time (if speed is provided and very low)
  if (locationData.speed !== undefined && locationData.speed < 5) {
    // Speed less than 5 km/h - check if this is a prolonged idle
    // This would need to be tracked over time, so we'll check the last few location updates
    const recentLocations = await prisma.tripLocationHistory.findMany({
      where: {
        scheduledTripId: tripId,
        timestamp: {
          gte: new Date(
            locationData.timestamp.getTime() -
              alertConfig.idleTimeThreshold * 60 * 1000
          ),
        },
        speed: {
          lt: 5, // Less than 5 km/h
        },
      },
      orderBy: { timestamp: "desc" },
    });

    if (recentLocations.length >= 3) {
      // If we have multiple low-speed updates, consider it idle
      const firstIdleTime =
        recentLocations[recentLocations.length - 1].timestamp;
      const idleDuration =
        (locationData.timestamp.getTime() - firstIdleTime.getTime()) /
        (60 * 1000); // minutes

      if (idleDuration >= alertConfig.idleTimeThreshold) {
        alerts.push({
          tripId,
          driverId: locationData.driverId,
          alertType: AlertType.LONG_IDLE_TIME,
          severity:
            idleDuration > 15
              ? AlertSeverity.HIGH
              : idleDuration > 10
              ? AlertSeverity.MEDIUM
              : AlertSeverity.LOW,
          message: `Driver has been idle for ${idleDuration.toFixed(
            1
          )} minutes`,
          metadata: {
            idleDuration,
            speed: locationData.speed,
          },
          timestamp: locationData.timestamp,
        });
      }
    }
  }

  // 3. Check speed violations (if speed limit is configured)
  if (
    alertConfig.speedLimit &&
    locationData.speed !== undefined &&
    locationData.speed > alertConfig.speedLimit
  ) {
    const excessSpeed = locationData.speed - alertConfig.speedLimit;
    alerts.push({
      tripId,
      driverId: locationData.driverId,
      alertType: AlertType.SPEED_VIOLATION,
      severity:
        excessSpeed > 30
          ? AlertSeverity.HIGH
          : excessSpeed > 15
          ? AlertSeverity.MEDIUM
          : AlertSeverity.LOW,
      message: `Driver exceeding speed limit by ${excessSpeed.toFixed(
        1
      )} km/h (current: ${locationData.speed.toFixed(1)} km/h)`,
      metadata: {
        speed: locationData.speed,
      },
      timestamp: locationData.timestamp,
    });
  }

  // 4. Check checkpoint delays (if we have progress info)
  if (trip.progress && trip.points.length > 0) {
    const currentCheckpointIndex = trip.progress.currentPointIndex;
    if (currentCheckpointIndex < trip.points.length) {
      const currentCheckpoint = trip.points[currentCheckpointIndex];
      if (currentCheckpoint.expectedTime) {
        const expectedTime = new Date(currentCheckpoint.expectedTime);
        const now = locationData.timestamp;
        const delayMinutes =
          (now.getTime() - expectedTime.getTime()) / (60 * 1000);

        if (delayMinutes > 10 && !currentCheckpoint.reachedAt) {
          // More than 10 minutes late and checkpoint not reached
          alerts.push({
            tripId,
            driverId: locationData.driverId,
            alertType: AlertType.CHECKPOINT_DELAY,
            severity:
              delayMinutes > 30
                ? AlertSeverity.HIGH
                : delayMinutes > 20
                ? AlertSeverity.MEDIUM
                : AlertSeverity.LOW,
            message: `Driver is ${delayMinutes.toFixed(
              1
            )} minutes late to checkpoint: ${currentCheckpoint.name}`,
            metadata: {
              checkpointIndex: currentCheckpointIndex,
              expectedTime,
              actualTime: now,
            },
            timestamp: locationData.timestamp,
          });
        }
      }
    }
  }

  // 5. Check location update failures (check if last update was too long ago)
  if (trip.progress?.lastLocationUpdate) {
    const timeSinceLastUpdate =
      (locationData.timestamp.getTime() -
        trip.progress.lastLocationUpdate.getTime()) /
      (60 * 1000); // minutes

    if (timeSinceLastUpdate > alertConfig.locationUpdateTimeout) {
      alerts.push({
        tripId,
        driverId: locationData.driverId,
        alertType: AlertType.LOCATION_UPDATE_FAILURE,
        severity:
          timeSinceLastUpdate > 5
            ? AlertSeverity.HIGH
            : timeSinceLastUpdate > 3
            ? AlertSeverity.MEDIUM
            : AlertSeverity.LOW,
        message: `No location updates received for ${timeSinceLastUpdate.toFixed(
          1
        )} minutes`,
        metadata: {
          lastUpdateTime: trip.progress.lastLocationUpdate,
        },
        timestamp: locationData.timestamp,
      });
    }
  }

  return alerts;
}

/**
 * Send alerts to admin dashboard via WebSocket
 * This will be called from the WebSocket server
 */
export function sendAlertToAdmins(alert: TripAlert): void {
  // This function will be implemented in the WebSocket server
  // For now, we'll just export the interface
  // The actual WebSocket broadcast will happen in socket/server.js
}

/**
 * Store alert in database (optional - for alert history)
 */
export async function createAlertRecord(alert: TripAlert): Promise<void> {
  // For now, we'll just log alerts
  // In the future, you might want to create an Alert model in Prisma
  console.log(`[Trip Alert] ${alert.alertType} - ${alert.message}`, {
    tripId: alert.tripId,
    severity: alert.severity,
    timestamp: alert.timestamp,
  });
}

/**
 * Get alerts for a specific trip
 */
export async function getTripAlerts(
  tripId: string,
  startDate?: Date,
  endDate?: Date
): Promise<TripAlert[]> {
  // This would query an Alert model if we create one
  // For now, return empty array
  // In production, you'd want to store alerts in the database
  return [];
}
