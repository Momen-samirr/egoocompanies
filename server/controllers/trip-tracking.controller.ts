require("dotenv").config();
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import axios from "axios";
import {
  calculateDistanceFromRoute,
  calculateDistanceToCheckpoint,
  detectRouteDeviation,
  calculateRouteEfficiency,
  calculatePathDistance,
  isNearCheckpoint,
} from "../utils/route-calculator";
import {
  checkAndSendAlerts,
  createAlertRecord,
  AlertType,
} from "../services/trip-alerts.service";
import { calculateETA } from "../services/eta-calculator.service";

/**
 * Record trip location - called by driver app during active trips
 * POST /api/v1/driver/trip/location
 */
export const recordTripLocation = async (req: any, res: Response) => {
  try {
    const { tripId, latitude, longitude, heading, accuracy, speed } = req.body;
    const driverId = req.driver?.id;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!tripId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "tripId, latitude, and longitude are required",
      });
    }

    // Get trip with points and progress
    const trip = await prisma.scheduledTrip.findUnique({
      where: { id: tripId },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
        progress: true,
      },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Verify driver is assigned to this trip
    if (trip.assignedCaptainId !== driverId) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this trip",
      });
    }

    if (trip.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Trip is not active",
      });
    }

    // Convert speed from km/h to m/s if needed (assuming speed comes in km/h)
    const speedInKmh = speed || 0;

    // Calculate route metrics
    const plannedRoute = trip.points.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    const currentLocation = { latitude, longitude };
    const distanceFromRoute = calculateDistanceFromRoute(
      currentLocation,
      plannedRoute
    );
    const deviation = detectRouteDeviation(currentLocation, plannedRoute, 100);

    // Find next checkpoint
    const currentCheckpointIndex = trip.progress?.currentPointIndex || 0;
    let distanceFromNextCheckpoint: number | null = null;
    let isCheckpointReached = false;
    let checkpointIndex: number | null = null;
    let etaToNextCheckpoint: number | null = null;
    let etaCalculatedAt: Date | null = null;
    let etaMethod: string | null = null;

    if (currentCheckpointIndex < trip.points.length) {
      const nextCheckpoint = trip.points[currentCheckpointIndex];
      distanceFromNextCheckpoint = calculateDistanceToCheckpoint(
        currentLocation,
        nextCheckpoint
      );

      // Check if checkpoint is reached (within 50 meters)
      if (isNearCheckpoint(currentLocation, nextCheckpoint, 50)) {
        isCheckpointReached = true;
        checkpointIndex = currentCheckpointIndex;
      } else {
        // Calculate ETA to next checkpoint (only if not reached)
        try {
          const etaResult = await calculateETA(
            currentLocation,
            nextCheckpoint,
            speedInKmh
          );
          etaToNextCheckpoint = etaResult.etaMinutes;
          etaCalculatedAt = etaResult.timestamp;
          etaMethod = etaResult.method;
        } catch (error: any) {
          console.error(
            "[Trip Tracking] Error calculating ETA:",
            error.message
          );
          // Continue without ETA if calculation fails
        }
      }
    }

    // Detect idle state (speed < 5 km/h)
    const isIdle = speedInKmh < 5;

    // Create location history record
    const locationHistory = await prisma.tripLocationHistory.create({
      data: {
        scheduledTripId: tripId,
        driverId,
        latitude,
        longitude,
        heading: heading || null,
        accuracy: accuracy || null,
        speed: speedInKmh,
        distanceFromRoute,
        distanceFromNextCheckpoint,
        etaToNextCheckpoint,
        etaCalculatedAt,
        etaMethod,
        isCheckpointReached,
        checkpointIndex,
        isIdle,
        isRouteDeviation: deviation.isDeviated,
        timestamp: new Date(),
      },
    });

    // Update trip progress
    await prisma.tripProgress.update({
      where: { scheduledTripId: tripId },
      data: {
        lastLocationUpdate: new Date(),
        lastLatitude: latitude,
        lastLongitude: longitude,
      },
    });

    // Check and generate alerts (include ETA for proactive delay detection)
    const alerts = await checkAndSendAlerts(tripId, {
      driverId,
      latitude,
      longitude,
      speed: speedInKmh,
      distanceFromRoute,
      isIdle,
      timestamp: new Date(),
      etaMinutes: etaToNextCheckpoint || undefined,
      distanceMeters: distanceFromNextCheckpoint || undefined,
    });

    // Store alerts
    for (const alert of alerts) {
      await createAlertRecord(alert);
    }

    // Broadcast location update via WebSocket server
    try {
      const wsUrl = process.env.WEBSOCKET_URL || "http://localhost:8080";
      await fetch(`${wsUrl}/api/trip-location-update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tripId,
          driverId,
          location: { latitude, longitude, heading },
          speed: speedInKmh,
          deviationStatus: {
            isDeviated: deviation.isDeviated,
            distance: distanceFromRoute, // in meters
          },
          eta: etaToNextCheckpoint
            ? {
                minutes: etaToNextCheckpoint,
                method: etaMethod,
                calculatedAt: etaCalculatedAt?.toISOString(),
                distanceMeters: distanceFromNextCheckpoint,
              }
            : null,
          timestamp: new Date().toISOString(),
        }),
      }).catch((error) => {
        console.debug(
          "WebSocket server not available for trip location update:",
          error.message
        );
      });
    } catch (error) {
      // Silently fail - WebSocket broadcast is optional
      console.debug("Error broadcasting trip location update:", error);
    }

    // Broadcast alerts via WebSocket server
    for (const alert of alerts) {
      try {
        const wsUrl = process.env.WEBSOCKET_URL || "http://localhost:8080";
        await fetch(`${wsUrl}/api/trip-alert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(alert),
        }).catch((error) => {
          console.debug(
            "WebSocket server not available for trip alert:",
            error.message
          );
        });
      } catch (error) {
        console.debug("Error broadcasting trip alert:", error);
      }
    }

    res.status(201).json({
      success: true,
      locationHistory,
      alerts: alerts.length > 0 ? alerts : undefined,
    });
  } catch (error: any) {
    console.error("Error recording trip location:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to record trip location",
    });
  }
};

/**
 * Get location history for a trip
 * GET /api/v1/admin/trips/:id/location-history
 */
export const getTripLocationHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = "1", limit = "100", startDate, endDate } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      scheduledTripId: id,
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate as string);
      }
    }

    const [locationHistory, total] = await Promise.all([
      prisma.tripLocationHistory.findMany({
        where,
        orderBy: { timestamp: "asc" },
        skip,
        take: limitNum,
      }),
      prisma.tripLocationHistory.count({ where }),
    ]);

    res.json({
      success: true,
      locationHistory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error("Error fetching location history:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch location history",
    });
  }
};

/**
 * Get live tracking data for a trip
 * GET /api/v1/admin/trips/:id/live-tracking
 */
export const getTripLiveTracking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trip = await prisma.scheduledTrip.findUnique({
      where: { id },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
        progress: true,
        assignedCaptain: {
          select: {
            id: true,
            name: true,
            phone_number: true,
          },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Get recent location history (last 10 points)
    const recentLocations = await prisma.tripLocationHistory.findMany({
      where: { scheduledTripId: id },
      orderBy: { timestamp: "desc" },
      take: 10,
    });

    // Get current location (most recent)
    const currentLocation = recentLocations[0] || null;

    // Get next checkpoint info
    const currentCheckpointIndex = trip.progress?.currentPointIndex || 0;
    const nextCheckpoint =
      currentCheckpointIndex < trip.points.length
        ? trip.points[currentCheckpointIndex]
        : null;

    // Extract ETA from current location if available
    const etaInfo = currentLocation
      ? {
          minutes: currentLocation.etaToNextCheckpoint,
          method: currentLocation.etaMethod,
          calculatedAt: currentLocation.etaCalculatedAt,
          distanceMeters: currentLocation.distanceFromNextCheckpoint,
        }
      : null;

    res.json({
      success: true,
      trip: {
        id: trip.id,
        name: trip.name,
        status: trip.status,
        assignedCaptain: trip.assignedCaptain,
      },
      currentLocation,
      recentLocations: recentLocations.reverse(), // Reverse to show chronological order
      nextCheckpoint,
      progress: trip.progress,
      eta: etaInfo,
    });
  } catch (error: any) {
    console.error("Error fetching live tracking data:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch live tracking data",
    });
  }
};

/**
 * Get route analysis for a trip
 * GET /api/v1/admin/trips/:id/route-analysis
 */
export const getTripRouteAnalysis = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trip = await prisma.scheduledTrip.findUnique({
      where: { id },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
        locationHistory: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const plannedRoute = trip.points.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    const actualPath = trip.locationHistory.map((l) => ({
      latitude: l.latitude,
      longitude: l.longitude,
    }));

    // Calculate distances
    const plannedDistance = calculatePathDistance(plannedRoute);
    const actualDistance = calculatePathDistance(actualPath);
    const routeEfficiency = calculateRouteEfficiency(actualPath, plannedRoute);

    // Find deviation segments
    const deviationSegments: Array<{
      start: { latitude: number; longitude: number; timestamp: Date };
      end: { latitude: number; longitude: number; timestamp: Date };
      maxDeviation: number;
      duration: number; // minutes
    }> = [];

    let currentDeviationStart: (typeof trip.locationHistory)[0] | null = null;
    let maxDeviationInSegment = 0;

    for (const location of trip.locationHistory) {
      if (location.isRouteDeviation) {
        if (!currentDeviationStart) {
          currentDeviationStart = location;
          maxDeviationInSegment = location.distanceFromRoute || 0;
        } else {
          maxDeviationInSegment = Math.max(
            maxDeviationInSegment,
            location.distanceFromRoute || 0
          );
        }
      } else {
        if (currentDeviationStart) {
          const lastLocation = trip.locationHistory.find(
            (l) => l.id === location.id
          );
          if (lastLocation) {
            deviationSegments.push({
              start: {
                latitude: currentDeviationStart.latitude,
                longitude: currentDeviationStart.longitude,
                timestamp: currentDeviationStart.timestamp,
              },
              end: {
                latitude: lastLocation.latitude,
                longitude: lastLocation.longitude,
                timestamp: lastLocation.timestamp,
              },
              maxDeviation: maxDeviationInSegment,
              duration:
                (lastLocation.timestamp.getTime() -
                  currentDeviationStart.timestamp.getTime()) /
                (60 * 1000),
            });
          }
          currentDeviationStart = null;
          maxDeviationInSegment = 0;
        }
      }
    }

    // Calculate total deviation distance
    const totalDeviationDistance = trip.locationHistory.reduce(
      (sum, loc) => sum + (loc.distanceFromRoute || 0),
      0
    );
    const averageDeviation =
      trip.locationHistory.length > 0
        ? totalDeviationDistance / trip.locationHistory.length
        : 0;

    res.json({
      success: true,
      plannedRoute,
      actualPath,
      plannedDistance,
      actualDistance,
      routeEfficiency,
      deviationSegments,
      statistics: {
        totalDeviationDistance,
        averageDeviation,
        largestDeviation: Math.max(
          ...trip.locationHistory.map((l) => l.distanceFromRoute || 0)
        ),
        deviationCount: trip.locationHistory.filter((l) => l.isRouteDeviation)
          .length,
      },
    });
  } catch (error: any) {
    console.error("Error analyzing route:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze route",
    });
  }
};

/**
 * Get trip analytics
 * GET /api/v1/admin/trips/:id/analytics
 */
export const getTripAnalytics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trip = await prisma.scheduledTrip.findUnique({
      where: { id },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
        locationHistory: {
          orderBy: { timestamp: "asc" },
        },
        progress: true,
      },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const locations = trip.locationHistory;

    if (locations.length === 0) {
      return res.json({
        success: true,
        analytics: {
          averageSpeed: 0,
          maxSpeed: 0,
          totalIdleTime: 0,
          idleSegments: [],
          checkpointTimings: [],
          routeAdherence: 100,
          totalDistance: 0,
        },
      });
    }

    // Calculate speeds
    const speeds = locations.map((l) => l.speed || 0).filter((s) => s > 0);
    const averageSpeed =
      speeds.length > 0
        ? speeds.reduce((sum, s) => sum + s, 0) / speeds.length
        : 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

    // Calculate idle time
    const idleLocations = locations.filter((l) => l.isIdle);
    let totalIdleTime = 0; // minutes
    const idleSegments: Array<{
      start: Date;
      end: Date;
      duration: number; // minutes
    }> = [];

    let idleStart: (typeof locations)[0] | null = null;
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      if (loc.isIdle) {
        if (!idleStart) {
          idleStart = loc;
        }
      } else {
        if (idleStart) {
          const duration =
            (loc.timestamp.getTime() - idleStart.timestamp.getTime()) /
            (60 * 1000);
          totalIdleTime += duration;
          idleSegments.push({
            start: idleStart.timestamp,
            end: loc.timestamp,
            duration,
          });
          idleStart = null;
        }
      }
    }

    // Checkpoint timings
    const checkpointTimings = trip.points.map((point) => {
      const reachedLocation = locations.find(
        (l) => l.checkpointIndex === point.order && l.isCheckpointReached
      );
      return {
        checkpointIndex: point.order,
        checkpointName: point.name,
        expectedTime: point.expectedTime,
        reachedAt: reachedLocation?.timestamp || null,
        delayMinutes:
          reachedLocation && point.expectedTime
            ? (reachedLocation.timestamp.getTime() -
                new Date(point.expectedTime).getTime()) /
              (60 * 1000)
            : null,
      };
    });

    // Route adherence (percentage of locations that are not deviated)
    const nonDeviatedCount = locations.filter(
      (l) => !l.isRouteDeviation
    ).length;
    const routeAdherence =
      locations.length > 0 ? (nonDeviatedCount / locations.length) * 100 : 100;

    // Total distance traveled
    const actualPath = locations.map((l) => ({
      latitude: l.latitude,
      longitude: l.longitude,
    }));
    const totalDistance = calculatePathDistance(actualPath);

    res.json({
      success: true,
      analytics: {
        averageSpeed,
        maxSpeed,
        totalIdleTime,
        idleSegments,
        checkpointTimings,
        routeAdherence,
        totalDistance,
      },
    });
  } catch (error: any) {
    console.error("Error fetching trip analytics:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch trip analytics",
    });
  }
};

/**
 * Get active trips with live data
 * GET /api/v1/admin/trips/active/live
 */
export const getActiveTripsLive = async (req: Request, res: Response) => {
  try {
    const activeTrips = await prisma.scheduledTrip.findMany({
      where: { status: "ACTIVE" },
      include: {
        assignedCaptain: {
          select: {
            id: true,
            name: true,
            phone_number: true,
          },
        },
        progress: true,
        points: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Get current location for each trip
    const tripsWithLocation = await Promise.all(
      activeTrips.map(async (trip) => {
        const currentLocation = await prisma.tripLocationHistory.findFirst({
          where: { scheduledTripId: trip.id },
          orderBy: { timestamp: "desc" },
        });

        return {
          id: trip.id,
          name: trip.name,
          status: trip.status,
          assignedCaptain: trip.assignedCaptain,
          currentLocation,
          progress: trip.progress,
          nextCheckpoint:
            trip.progress &&
            trip.progress.currentPointIndex < trip.points.length
              ? trip.points[trip.progress.currentPointIndex]
              : null,
        };
      })
    );

    res.json({
      success: true,
      trips: tripsWithLocation,
      count: tripsWithLocation.length,
    });
  } catch (error: any) {
    console.error("Error fetching active trips:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch active trips",
    });
  }
};

/**
 * Get road distance and time from driver's current location to next checkpoint
 * GET /api/v1/admin/trips/:id/road-distance
 */
export const getRoadDistanceToNextCheckpoint = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "latitude and longitude query parameters are required",
      });
    }

    const trip = await prisma.scheduledTrip.findUnique({
      where: { id },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Find next unreached checkpoint
    const nextCheckpoint = trip.points.find((p) => !p.reachedAt);

    if (!nextCheckpoint) {
      return res.status(404).json({
        success: false,
        message: "No unreached checkpoint found",
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API key not configured",
      });
    }

    try {
      const origin = `${latitude},${longitude}`;
      const destination = `${nextCheckpoint.latitude},${nextCheckpoint.longitude}`;

      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
        {
          params: {
            origins: origin,
            destinations: destination,
            key: apiKey,
            mode: "driving",
            departure_time: "now",
            units: "metric",
          },
          timeout: 5000,
        }
      );

      if (response.data.status !== "OK") {
        return res.status(500).json({
          success: false,
          message: `Google Maps API error: ${response.data.status}`,
        });
      }

      const element = response.data.rows[0]?.elements[0];

      if (!element || element.status !== "OK") {
        return res.status(500).json({
          success: false,
          message: `Google Maps API element error: ${
            element?.status || "UNKNOWN"
          }`,
        });
      }

      const distanceInMeters = element.distance?.value;
      const durationInSeconds =
        element.duration_in_traffic?.value || element.duration?.value;

      if (!distanceInMeters || !durationInSeconds) {
        return res.status(500).json({
          success: false,
          message: "Missing distance or duration from Google Maps API",
        });
      }

      res.json({
        success: true,
        distance: distanceInMeters, // meters
        duration: durationInSeconds, // seconds
        checkpoint: {
          id: nextCheckpoint.id,
          name: nextCheckpoint.name,
          latitude: nextCheckpoint.latitude,
          longitude: nextCheckpoint.longitude,
        },
      });
    } catch (error: any) {
      console.error("Error calling Google Maps API:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch road distance",
      });
    }
  } catch (error: any) {
    console.error("Error getting road distance:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get road distance",
    });
  }
};
