import { useEffect, useRef, useState, useCallback } from "react";
import * as GeoLocation from "expo-location";
import { Toast } from "react-native-toast-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { AppState, AppStateStatus, Platform } from "react-native";
import { getServerUri } from "@/configs/constants";
import {
  requestAllLocationPermissions,
  getLocationPermissionStatus,
} from "@/utils/locationPermissions";
import {
  shouldSendLocationUpdate,
  shouldSendLocationUpdateEnhanced,
  calculateSpeed,
} from "@/utils/locationOptimizer";
import { locationFilter } from "@/utils/locationFilter";
import {
  LocationHistoryBuffer,
  calculateHeadingFromHistory,
} from "@/utils/headingCalculator";
import {
  queueLocationForOffline,
  flushOfflineQueue,
  isOnline,
} from "@/services/offlineQueue";
import { updateDriverLocation } from "@/services/locationService";
import {
  BACKGROUND_LOCATION_TASK,
  isBackgroundLocationTaskRegistered,
} from "@/services/backgroundLocationTask";
import { logger } from "@/lib/logger";

// Conditionally import TaskManager to avoid errors if native module isn't ready
let TaskManager: any = null;
try {
  TaskManager = require("expo-task-manager");
} catch (error) {
  logger.warn("expo-task-manager not available", error);
}

export interface Location {
  latitude: number;
  longitude: number;
  heading?: number; // Bearing/heading in degrees (0-360, where 0 is North)
}

export interface UseLocationTrackingOptions {
  isActive: boolean;
  onLocationUpdate?: (location: Location) => void;
  sendToServer?: boolean;
  sendToWebSocket?: (location: Location, driverData: any) => void;
  distanceThreshold?: number; // meters
}

export interface UseLocationTrackingReturn {
  currentLocation: Location | null;
  lastSentLocation: Location | null;
  isTracking: boolean;
  error: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

/**
 * Custom hook for location tracking
 * Handles location permissions, watching position, and sending updates
 */
export function useLocationTracking(
  options: UseLocationTrackingOptions
): UseLocationTrackingReturn {
  const {
    isActive,
    onLocationUpdate,
    sendToServer = true,
    sendToWebSocket,
    distanceThreshold = 200, // 200 meters default
  } = options;

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [lastSentLocation, setLastSentLocation] = useState<Location | null>(
    null
  );
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationWatchSubscription = useRef<any>(null);
  const isActiveRef = useRef(isActive);
  const firstLocationAfterActiveRef = useRef(false);
  const isTrackingRef = useRef(false);
  const lastSentLocationRef = useRef<Location | null>(null);
  const backgroundLocationStartedRef = useRef(false);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateSubscriptionRef = useRef<any>(null);
  const locationHistoryRef = useRef(new LocationHistoryBuffer(5));
  const networkCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatLocationRef = useRef<Location | null>(null);

  // Keep ref in sync with isActive
  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive && !firstLocationAfterActiveRef.current) {
      firstLocationAfterActiveRef.current = true;
    }
  }, [isActive]);

  // Send location update to server/WebSocket
  const sendLocationUpdate = useCallback(
    async (location: Location) => {
      const currentIsActive = isActiveRef.current;
      if (!currentIsActive) {
        logger.debug("Driver is inactive - skipping location update");
        return;
      }

      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        if (!accessToken) {
          logger.error("No access token - cannot fetch driver data");
          return;
        }

        // Get driver data
        const driverResponse = await axios.get(`${getServerUri()}/driver/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (driverResponse.data && driverResponse.data.driver) {
          const driverData = driverResponse.data.driver;
          const driverStatus = driverData.status || "active";

          // Send to WebSocket if handler provided
          if (sendToWebSocket) {
            sendToWebSocket(location, driverData);
          }

          // Send to server for scheduled trips
          if (sendToServer) {
            try {
              const response = await updateDriverLocation(location);
              if (response.success && response.activationChecks) {
                const availableTrips = response.activationChecks.filter(
                  (check: any) => check.canActivate
                );
                if (availableTrips.length > 0) {
                  logger.info(
                    `${availableTrips.length} trip(s) are now available to start`
                  );
                }
              }
            } catch (error: any) {
              // Check if it's a network error
              const isNetworkError =
                error.message?.includes("Network") ||
                error.message?.includes("timeout") ||
                error.code === "NETWORK_ERROR" ||
                !error.response;

              if (isNetworkError) {
                // Queue for offline sending
                logger.debug("Network error - queueing location for offline");
                await queueLocationForOffline(location);
              } else if (
                error.response?.status === 400 &&
                error.response?.data?.message?.includes("online")
              ) {
                logger.debug("Location update skipped - driver is offline");
              } else {
                logger.warn(
                  "Failed to update location for scheduled trips",
                  error
                );
              }
            }
          }

          logger.debug("Location update sent", {
            driverId: driverData.id,
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }
      } catch (error: any) {
        // Check if it's a network error
        const isNetworkError =
          error.message?.includes("Network") ||
          error.message?.includes("timeout") ||
          error.code === "NETWORK_ERROR" ||
          !error.response;

        if (isNetworkError) {
          logger.debug("Network error - queueing location for offline");
          await queueLocationForOffline(location);
        } else {
          logger.error("Error sending location update", error);
        }
      }
    },
    [sendToServer, sendToWebSocket]
  );

  // Start location tracking
  const startTracking = useCallback(async () => {
    // Guard: Prevent restarting if already tracking
    if (isTrackingRef.current) {
      logger.debug("Location tracking already active, skipping restart");
      return;
    }

    try {
      // Clean up previous subscription
      if (locationWatchSubscription.current) {
        locationWatchSubscription.current.remove();
        locationWatchSubscription.current = null;
      }

      // Request permissions
      logger.info("Requesting location permissions");
      const { foreground, background } = await requestAllLocationPermissions();

      if (!foreground) {
        setError("Location permission denied");
        Toast.show("Please grant location permission to use this app!", {
          type: "danger",
        });
        return;
      }

      if (!background) {
        logger.warn("Background location permission not granted");
        Toast.show(
          "Background location is required for tracking when screen is off. Please enable it in Settings.",
          {
            type: "warning",
            duration: 5000,
          }
        );
      }

      const permissionStatus = await getLocationPermissionStatus();
      logger.debug("Location permission status", permissionStatus);

      // Reset first location flag
      firstLocationAfterActiveRef.current = isActiveRef.current;

      // CRITICAL: Ensure task is registered BEFORE starting location updates
      if (isActive && TaskManager) {
        try {
          // Wait for task registration with timeout
          let taskRegistered = false;
          let attempts = 0;
          const maxAttempts = 10;

          while (!taskRegistered && attempts < maxAttempts) {
            taskRegistered = await isBackgroundLocationTaskRegistered();
            if (!taskRegistered) {
              logger.debug(
                `Waiting for background location task registration (attempt ${
                  attempts + 1
                }/${maxAttempts})...`
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
              attempts++;
            }
          }

          if (!taskRegistered) {
            logger.error(
              "Background location task not registered after waiting - location tracking may not work in background"
            );
            Toast.show(
              "Background location tracking may not work. Please restart the app.",
              {
                type: "warning",
                duration: 5000,
              }
            );
          } else {
            logger.info("Background location task is registered and ready");
          }

          // Start background location updates using task manager
          // This works even when the app is in the background
          try {
            await GeoLocation.startLocationUpdatesAsync(
              BACKGROUND_LOCATION_TASK,
              {
                accuracy: GeoLocation.Accuracy.High,
                timeInterval: 10000, // 10 seconds - ensures minimum update interval for current "Last update" time
                distanceInterval: 5, // 5 meters - more sensitive to movement
                // Foreground service configuration for Android
                foregroundService: {
                  notificationTitle: "Location Tracking Active",
                  notificationBody: "Tracking your location for ride requests",
                  notificationColor: "#10B981",
                  notificationChannel: "location-tracking",
                },
                // Prevent automatic pausing when app is in background
                pausesUpdatesAutomatically: false,
                // Show location indicator in iOS status bar
                showsBackgroundLocationIndicator: true,
                // Android-specific configuration
                ...(Platform.OS === "android" && {
                  deferredUpdatesInterval: 10000, // 10 seconds when stationary - ensures updates even when not moving
                  deferredUpdatesDistance: 5, // 5 meters when stationary - more sensitive
                }),
              }
            );
            backgroundLocationStartedRef.current = true;
            logger.info("Background location tracking started successfully");
          } catch (error: any) {
            logger.error("Error starting background location tracking", error);
            backgroundLocationStartedRef.current = false;
            Toast.show(
              `Failed to start background tracking: ${error.message}`,
              {
                type: "danger",
                duration: 5000,
              }
            );
          }
        } catch (error: any) {
          logger.error("Error verifying task registration", error);
        }
      } else if (isActive && !TaskManager) {
        logger.warn(
          "TaskManager not available - background location tracking will not work"
        );
        Toast.show(
          "Background location tracking unavailable. Please update the app.",
          {
            type: "warning",
            duration: 5000,
          }
        );
      }

      // Also set up a foreground watcher for immediate UI updates
      // This provides faster updates when the app is in the foreground
      const subscription = await GeoLocation.watchPositionAsync(
        {
          accuracy: GeoLocation.Accuracy.High,
          timeInterval: 10000, // 10 seconds - aligned with background updates for consistency
          distanceInterval: 10, // 10 meters
          mayShowUserSettingsDialog: true,
        },
        async (position) => {
          const { latitude, longitude, heading, accuracy } = position.coords;
          const timestamp = position.timestamp || Date.now();

          // Filter location for accuracy improvement
          const filteredPoint = locationFilter.filter({
            latitude,
            longitude,
            accuracy: accuracy || 50, // Default accuracy if not provided
            timestamp,
          });

          // Calculate heading from history if GPS heading unavailable
          let calculatedHeading = heading;
          if (
            (heading === null || heading === undefined || heading < 0) &&
            locationHistoryRef.current.size() >= 2
          ) {
            const historyHeading =
              locationHistoryRef.current.calculateHeading();
            if (historyHeading !== null) {
              calculatedHeading = historyHeading;
              logger.debug(
                `Calculated heading from history: ${calculatedHeading}°`
              );
            }
          }

          const newLocation: Location = {
            latitude: filteredPoint.latitude,
            longitude: filteredPoint.longitude,
            heading:
              calculatedHeading !== null &&
              calculatedHeading !== undefined &&
              calculatedHeading >= 0
                ? calculatedHeading
                : undefined,
          };

          // Add to location history for heading calculation
          locationHistoryRef.current.add({
            latitude: filteredPoint.latitude,
            longitude: filteredPoint.longitude,
            timestamp,
          });

          // Always update current location for UI
          setCurrentLocation(newLocation);

          // Call onLocationUpdate callback
          if (onLocationUpdate) {
            onLocationUpdate(newLocation);
          }

          // Check if we should send update using enhanced adaptive thresholds
          const currentIsActive = isActiveRef.current;
          const currentLastSentLocation = lastSentLocationRef.current;

          // Calculate speed for adaptive threshold
          let speed: number | null = null;
          if (
            currentLastSentLocation &&
            lastSentLocationRef.current &&
            timestamp &&
            lastSentLocationRef.current.heading !== undefined
          ) {
            speed = calculateSpeed(
              {
                latitude: currentLastSentLocation.latitude,
                longitude: currentLastSentLocation.longitude,
                timestamp: timestamp - 5000, // Approximate previous timestamp
              },
              {
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                timestamp,
              }
            );
          }

          const shouldSend =
            firstLocationAfterActiveRef.current ||
            shouldSendLocationUpdateEnhanced(
              currentLastSentLocation
                ? {
                    latitude: currentLastSentLocation.latitude,
                    longitude: currentLastSentLocation.longitude,
                    timestamp: timestamp - 5000,
                  }
                : null,
              {
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                timestamp,
              },
              distanceThreshold
            );

          if (currentIsActive && shouldSend) {
            const isFirstAfterActive = firstLocationAfterActiveRef.current;
            firstLocationAfterActiveRef.current = false;

            lastSentLocationRef.current = newLocation;
            setLastSentLocation(newLocation);

            await sendLocationUpdate(newLocation);
          } else {
            // Update lastSentLocation even if not sending
            lastSentLocationRef.current = newLocation;
            setLastSentLocation(newLocation);
            if (!currentIsActive) {
              logger.debug(
                "Location received but driver is inactive - not sending"
              );
            } else {
              logger.debug(
                `Location update skipped (adaptive threshold not met, speed: ${
                  speed !== null ? `${speed.toFixed(2)} m/s` : "unknown"
                })`
              );
            }
          }
        }
      );

      locationWatchSubscription.current = subscription;
      isTrackingRef.current = true;
      setIsTracking(true);
      setError(null);
      logger.info("Location tracking started (background + foreground)");
    } catch (err: any) {
      logger.error("Error starting location tracking", err);
      setError(err.message || "Failed to start location tracking");
      setIsTracking(false);
    }
  }, [
    onLocationUpdate,
    sendLocationUpdate,
    distanceThreshold,
    // Removed lastSentLocation from dependencies - using ref instead to prevent infinite loop
  ]);

  // Stop location tracking
  const stopTracking = useCallback(async () => {
    // Stop monitoring
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }

    // Stop network check interval
    if (networkCheckIntervalRef.current) {
      clearInterval(networkCheckIntervalRef.current);
      networkCheckIntervalRef.current = null;
    }

    // Stop heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Stop foreground watcher
    if (locationWatchSubscription.current) {
      locationWatchSubscription.current.remove();
      locationWatchSubscription.current = null;
    }

    // Stop background location updates
    if (TaskManager && TaskManager.isTaskRegisteredAsync) {
      try {
        const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(
          BACKGROUND_LOCATION_TASK
        );
        if (isTaskRegistered) {
          const hasStarted = await GeoLocation.hasStartedLocationUpdatesAsync(
            BACKGROUND_LOCATION_TASK
          );
          if (hasStarted) {
            await GeoLocation.stopLocationUpdatesAsync(
              BACKGROUND_LOCATION_TASK
            );
            logger.info("Background location tracking stopped");
          }
        }
      } catch (error: any) {
        logger.error("Error stopping background location tracking", error);
      }
    }

    // Clear location history
    locationHistoryRef.current.clear();
    locationFilter.clear();

    backgroundLocationStartedRef.current = false;
    isTrackingRef.current = false;
    setIsTracking(false);
    logger.info("Location tracking stopped");
  }, []);

  // Monitor background location tracking and recover if it stops
  const monitorBackgroundTracking = useCallback(async () => {
    if (!isActiveRef.current || !isTrackingRef.current) {
      return;
    }

    try {
      const hasStarted = await GeoLocation.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK
      );

      if (!hasStarted && backgroundLocationStartedRef.current) {
        logger.warn(
          "Background location tracking stopped unexpectedly - attempting to restart"
        );

        // Try to restart background tracking
        try {
          const taskRegistered = await isBackgroundLocationTaskRegistered();
          if (taskRegistered && isActiveRef.current) {
            await GeoLocation.startLocationUpdatesAsync(
              BACKGROUND_LOCATION_TASK,
              {
                accuracy: GeoLocation.Accuracy.High,
                timeInterval: 5000,
                distanceInterval: 10,
                foregroundService: {
                  notificationTitle: "Location Tracking Active",
                  notificationBody: "Tracking your location for ride requests",
                  notificationColor: "#10B981",
                  notificationChannel: "location-tracking",
                },
                pausesUpdatesAutomatically: false,
                showsBackgroundLocationIndicator: true,
                ...(Platform.OS === "android" && {
                  deferredUpdatesInterval: 10000,
                  deferredUpdatesDistance: 50,
                }),
              }
            );
            logger.info("Background location tracking recovered successfully");
            backgroundLocationStartedRef.current = true;
          }
        } catch (error: any) {
          logger.error("Failed to recover background location tracking", error);
        }
      }
    } catch (error: any) {
      logger.error("Error monitoring background location tracking", error);
    }
  }, []);

  // Setup AppState listener to handle app backgrounding/foregrounding
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      logger.debug(`App state changed to: ${nextAppState}`);

      if (nextAppState === "background" || nextAppState === "inactive") {
        // App went to background - ensure background tracking is running
        if (isTrackingRef.current && !backgroundLocationStartedRef.current) {
          logger.info(
            "App went to background - ensuring background location tracking is active"
          );
          await monitorBackgroundTracking();
        }
      } else if (nextAppState === "active") {
        // App came to foreground - verify tracking is still running
        if (isTrackingRef.current) {
          logger.debug(
            "App came to foreground - verifying location tracking status"
          );
          await monitorBackgroundTracking();
        }
      }
    };

    appStateSubscriptionRef.current = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      if (appStateSubscriptionRef.current) {
        appStateSubscriptionRef.current.remove();
        appStateSubscriptionRef.current = null;
      }
    };
  }, [isActive, monitorBackgroundTracking]);

  // Setup periodic monitoring of background location tracking
  useEffect(() => {
    if (!isActive || !isTrackingRef.current) {
      return;
    }

    // Check every 10 seconds if background tracking is still running - more frequent checks for faster issue detection
    monitoringIntervalRef.current = setInterval(() => {
      monitorBackgroundTracking();
    }, 10000);

    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
    };
  }, [isActive, monitorBackgroundTracking]);

  // Setup periodic network check and offline queue flush
  useEffect(() => {
    if (!isActive || !isTrackingRef.current) {
      return;
    }

    // Check network and flush queue every 60 seconds
    networkCheckIntervalRef.current = setInterval(async () => {
      try {
        const online = await isOnline();
        if (online) {
          // Try to flush offline queue
          const flushedCount = await flushOfflineQueue();
          if (flushedCount > 0) {
            logger.info(`Flushed ${flushedCount} locations from offline queue`);
          }
        }
      } catch (error) {
        logger.error("Error checking network/flushing queue", error);
      }
    }, 60000); // Check every minute

    // Also flush immediately when app comes to foreground
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        try {
          const flushedCount = await flushOfflineQueue();
          if (flushedCount > 0) {
            logger.info(
              `Flushed ${flushedCount} locations from offline queue on app foreground`
            );
          }
        } catch (error) {
          logger.error("Error flushing queue on foreground", error);
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      if (networkCheckIntervalRef.current) {
        clearInterval(networkCheckIntervalRef.current);
        networkCheckIntervalRef.current = null;
      }
      subscription.remove();
    };
  }, [isActive]);

  // Heartbeat mechanism: Send location update every 30 seconds even when stationary
  // This ensures foreground updates continue even when driver is stationary and adaptive thresholds prevent normal updates
  useEffect(() => {
    if (!isActive || !isTrackingRef.current || !currentLocation) {
      return;
    }

    // Send heartbeat every 30 seconds
    heartbeatIntervalRef.current = setInterval(async () => {
      const currentIsActive = isActiveRef.current;
      const currentLoc = currentLocation;

      if (currentIsActive && currentLoc) {
        logger.debug("Sending heartbeat location update");
        await sendLocationUpdate(currentLoc);
        lastHeartbeatLocationRef.current = currentLoc;
      }
    }, 30000); // 30 seconds

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [isActive, currentLocation, sendLocationUpdate]);

  // Start/stop tracking based on isActive
  useEffect(() => {
    // Only start/stop if state actually changed
    if (isActive && !isTrackingRef.current) {
      startTracking();
    } else if (!isActive && isTrackingRef.current) {
      stopTracking();
    }

    return () => {
      // Only cleanup if we're actually tracking
      if (isTrackingRef.current) {
        stopTracking();
      }
    };
  }, [isActive, startTracking, stopTracking]);

  return {
    currentLocation,
    lastSentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking,
  };
}
