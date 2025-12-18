import { useEffect, useRef, useState, useCallback } from "react";
import * as GeoLocation from "expo-location";
import { Toast } from "react-native-toast-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { AppState, AppStateStatus, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { getServerUri } from "@/configs/constants";
import {
  requestAllLocationPermissions,
  getLocationPermissionStatus,
} from "@/utils/locationPermissions";
import {
  shouldSendLocationUpdateEnhanced,
  calculateSpeed,
} from "@/utils/locationOptimizer";
import { locationFilter } from "@/utils/locationFilter";
import { LocationHistoryBuffer } from "@/utils/headingCalculator";
import {
  queueLocationForOffline,
  flushOfflineQueue,
  isOnline,
} from "@/services/offlineQueue";
import { updateDriverLocation } from "@/services/locationService";
import { BACKGROUND_LOCATION_TASK } from "@/services/backgroundLocationTask";
import { logger } from "@/lib/logger";
import { ensureBatteryOptimizationDisabled } from "@/utils/batteryOptimization";

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
  const sentStopNotificationRef = useRef(false);

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

          // Send to WebSocket if handler provided (only works in foreground)
          // In background, WebSocket is disconnected, so this will be skipped
          if (sendToWebSocket) {
            logger.debug(
              "[LocationTracking] Attempting to send location via WebSocket (foreground mode)"
            );
            sendToWebSocket(location, driverData);
          } else {
            logger.debug(
              "[LocationTracking] WebSocket handler not provided - location will be sent via HTTP API only"
            );
          }

          // Send to server for scheduled trips (always via HTTP API)
          // This HTTP call also triggers socket server notification via backend,
          // ensuring dashboard sees driver location even when WebSocket is disconnected
          if (sendToServer) {
            logger.debug(
              "[LocationTracking] Sending location update via HTTP API (works in both foreground and background)"
            );
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

          logger.info("Location update sent successfully", {
            driverId: driverData.id,
            latitude: location.latitude,
            longitude: location.longitude,
            heading: location.heading ?? null,
            method: sendToWebSocket ? "WebSocket + HTTP" : "HTTP only",
            timestamp: new Date().toISOString(),
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

      // Check and prompt for battery optimization (critical for background tracking)
      // This ensures the app can run in background without being killed by the system
      if (Platform.OS === "android") {
        try {
          await ensureBatteryOptimizationDisabled();
        } catch (error: any) {
          logger.warn("Error checking battery optimization", error);
          // Don't block tracking if battery optimization check fails
        }
      }

      // Reset first location flag
      firstLocationAfterActiveRef.current = isActiveRef.current;
      sentStopNotificationRef.current = false;

      // CRITICAL: Start background location service ONLY when app is in foreground
      // Android 12+ restriction: Foreground services MUST be started while app is active
      if (isActive && TaskManager) {
        // Check AppState - must be 'active' to start foreground service
        const currentAppState = AppState.currentState;
        console.log(
          `🔍 [DEBUG] Starting background location - AppState: ${currentAppState}`
        );

        if (currentAppState !== "active") {
          logger.error(
            `Cannot start background location - AppState is ${currentAppState}, not 'active'`
          );
          Toast.show(
            "Cannot start location tracking from background. Please bring app to foreground.",
            {
              type: "danger",
              duration: 5000,
            }
          );
          return;
        }

        // Verify task is registered with TaskManager
        try {
          const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(
            BACKGROUND_LOCATION_TASK
          );
          console.log(`🔍 [DEBUG] Task registered check: ${isTaskRegistered}`);

          if (!isTaskRegistered) {
            logger.error(
              `Background location task '${BACKGROUND_LOCATION_TASK}' is not registered`
            );
            Toast.show(
              "Location tracking task not registered. Please restart the app.",
              {
                type: "danger",
                duration: 5000,
              }
            );
            return;
          }
        } catch (error: any) {
          logger.error("Error checking task registration", error);
          console.error("[DEBUG] Task registration check failed:", error);
        }

        // Start background location updates using task manager
        logger.info("Starting background location task...");
        try {
          console.log(
            "🚀 [DEBUG] Attempting to start background location updates..."
          );

          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "useLocationTracking.ts:321",
                message: "About to call startLocationUpdatesAsync",
                data: {
                  appState: AppState.currentState,
                  platform: Platform.OS,
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "A",
              }),
            }
          ).catch(() => {});
          // #endregion

          const startAsyncStartTime = Date.now();
          const startResult = await GeoLocation.startLocationUpdatesAsync(
            BACKGROUND_LOCATION_TASK,
            {
              accuracy: GeoLocation.Accuracy.High,
              timeInterval: 10000, // 10 seconds
              distanceInterval: 5, // 5 meters
              // Foreground service configuration for Android
              // Configured for maximum reliability: persistent, high priority, non-dismissible
              foregroundService: {
                notificationTitle: "Location Tracking Active",
                notificationBody: "Tracking your location for ride requests",
                notificationColor: "#10B981",
                notificationChannelId: "location-tracking",
              },
              pausesUpdatesAutomatically: false,
              showsBackgroundLocationIndicator: true,
              // Android-specific configuration
              ...(Platform.OS === "android" && {
                deferredUpdatesInterval: 10000,
                deferredUpdatesDistance: 5,
              }),
            }
          );
          const startAsyncDuration = Date.now() - startAsyncStartTime;

          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "useLocationTracking.ts:354",
                message: "startLocationUpdatesAsync completed",
                data: { startResult, duration: startAsyncDuration },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "A",
              }),
            }
          ).catch(() => {});
          // #endregion

          console.log(
            "✅ [DEBUG] startLocationUpdatesAsync completed:",
            startResult
          );

          // CRITICAL: Verify service is actually running with multiple checks
          // Service startup can take time, so we verify multiple times with delays
          logger.info("Verifying background service startup...");
          const verifyStartTime = Date.now();
          const isRunning = await verifyBackgroundServiceRunning(3, 1000);
          const verifyDuration = Date.now() - verifyStartTime;

          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "useLocationTracking.ts:360",
                message: "Initial verification result",
                data: { isRunning, verifyDuration, startAsyncDuration },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "A",
              }),
            }
          ).catch(() => {});
          // #endregion

          if (isRunning) {
            backgroundLocationStartedRef.current = true;
            logger.info(
              "✅ Background location service started and verified successfully"
            );
            console.log(
              "✅ [DEBUG] Background location service is running and verified"
            );
          } else {
            // Service failed to start or verify - provide detailed error
            backgroundLocationStartedRef.current = false;
            logger.error(
              "❌ Background location service failed to start or verify - service not running after startup"
            );
            console.error(
              "❌ [DEBUG] CRITICAL: Service startup verification failed"
            );

            Toast.show(
              "Failed to start background location tracking. Please check app permissions and try again.",
              {
                type: "danger",
                duration: 5000,
              }
            );
          }
        } catch (error: any) {
          backgroundLocationStartedRef.current = false;
          logger.error("❌ Error starting background location service", {
            error: error.message,
            code: error.code,
            stack: error.stack,
          });
          console.error("❌ [DEBUG] Exception during service startup:", error);

          // Provide specific error messages based on error type
          let errorMessage = "Failed to start background tracking";
          if (error.message?.includes("permission")) {
            errorMessage =
              "Location permission denied. Please enable in settings.";
          } else if (error.message?.includes("background")) {
            errorMessage = "Background location permission required.";
          } else if (error.code === "E_LOCATION_SERVICES_DISABLED") {
            errorMessage =
              "Location services are disabled. Please enable in device settings.";
          }

          Toast.show(errorMessage, {
            type: "danger",
            duration: 5000,
          });
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

  // Verify that background location service is actually running
  // Uses retry logic to account for service startup delays
  const verifyBackgroundServiceRunning = useCallback(
    async (
      maxRetries: number = 3,
      delayMs: number = 1000
    ): Promise<boolean> => {
      logger.debug(
        `Verifying background service is running (maxRetries: ${maxRetries})`
      );

      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "useLocationTracking.ts:641",
            message: "Verification starting",
            data: { maxRetries, delayMs },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "B",
          }),
        }
      ).catch(() => {});
      // #endregion

      for (let i = 0; i < maxRetries; i++) {
        // Wait progressively longer between checks (1s, 2s, 3s...)
        if (i > 0) {
          const waitTime = delayMs * i;
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "useLocationTracking.ts:648",
                message: "Waiting before verification attempt",
                data: { waitTime, attempt: i + 1, maxRetries },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "A",
              }),
            }
          ).catch(() => {});
          // #endregion
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        try {
          const checkStartTime = Date.now();
          const hasStarted = await GeoLocation.hasStartedLocationUpdatesAsync(
            BACKGROUND_LOCATION_TASK
          );
          const checkDuration = Date.now() - checkStartTime;

          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "useLocationTracking.ts:658",
                message: "hasStartedLocationUpdatesAsync result",
                data: { hasStarted, checkDuration, attempt: i + 1, maxRetries },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "B",
              }),
            }
          ).catch(() => {});
          // #endregion

          logger.debug(
            `Background service verification attempt ${i + 1}/${maxRetries}: ${
              hasStarted ? "RUNNING" : "STOPPED"
            }`
          );

          if (hasStarted) {
            logger.info("✅ Background service verified as running");
            // #region agent log
            fetch(
              "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "useLocationTracking.ts:667",
                  message: "Verification succeeded",
                  data: { attempt: i + 1 },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "run1",
                  hypothesisId: "B",
                }),
              }
            ).catch(() => {});
            // #endregion
            return true;
          }
        } catch (error: any) {
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "useLocationTracking.ts:672",
                message: "Error checking service status",
                data: {
                  error: error?.message,
                  code: error?.code,
                  attempt: i + 1,
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "B",
              }),
            }
          ).catch(() => {});
          // #endregion
          logger.warn(
            `Error checking background service status (attempt ${i + 1}):`,
            error
          );
        }
      }

      logger.warn(
        `❌ Background service verification failed after ${maxRetries} attempts`
      );
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "useLocationTracking.ts:682",
            message: "Verification failed all attempts",
            data: { maxRetries },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "B",
          }),
        }
      ).catch(() => {});
      // #endregion
      return false;
    },
    []
  );

  // Monitor background location tracking status
  // NOTE: On Android 12+, we CANNOT start a foreground service from the background.
  // This function only monitors the status and logs warnings if tracking stops.
  // The service MUST be started while the app is in the foreground (via startTracking).
  const monitorBackgroundTracking = useCallback(async () => {
    const timestamp = new Date().toISOString();
    logger.debug(
      `[Monitor ${timestamp}] Checking background location service status`,
      {
        isActive: isActiveRef.current,
        isTracking: isTrackingRef.current,
        appState: AppState.currentState,
      }
    );

    if (!isActiveRef.current || !isTrackingRef.current) {
      logger.debug(
        `[Monitor ${timestamp}] Early exit - driver inactive or tracking stopped`
      );
      return;
    }

    try {
      const hasStarted = await GeoLocation.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK
      );

      logger.debug(`[Monitor ${timestamp}] Service status check`, {
        hasStarted,
        expectedRunning: backgroundLocationStartedRef.current,
        appState: AppState.currentState,
      });

      if (!hasStarted) {
        logger.warn(
          `[Monitor ${timestamp}] ⚠️ Background location task stopped unexpectedly!`,
          {
            wasExpectedRunning: backgroundLocationStartedRef.current,
            appState: AppState.currentState,
            platform: Platform.OS,
          }
        );

        // Mark as stopped
        const wasRunning = backgroundLocationStartedRef.current;
        backgroundLocationStartedRef.current = false;

        // On Android 12+, we cannot start foreground service from background
        // User needs to bring app to foreground to restart tracking
        if (Platform.OS === "android") {
          logger.warn(
            `[Monitor ${timestamp}] Android 12+ restriction: Cannot start foreground service from background.`,
            {
              appState: AppState.currentState,
              canRestart: AppState.currentState === "active",
            }
          );

          // Trigger a local notification to get the user's attention
          // Only send once per stop event to avoid spam
          if (!sentStopNotificationRef.current) {
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: "⚠️ Location Tracking Stopped",
                  body: "Tap to resume driver location tracking",
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                  data: { type: "tracking_stopped", timestamp },
                },
                trigger: null,
              });
              sentStopNotificationRef.current = true;
              logger.info(
                `[Monitor ${timestamp}] Sent recovery notification to user`
              );
            } catch (notifyError) {
              logger.error(
                `[Monitor ${timestamp}] Failed to send recovery notification`,
                notifyError
              );
            }
          }
        }
      } else {
        // Service is running - log periodically for health monitoring
        if (backgroundLocationStartedRef.current) {
          logger.debug(
            `[Monitor ${timestamp}] ✅ Background location tracking is active and healthy`
          );
        } else {
          // Service is running but our ref was false - update it
          logger.info(
            `[Monitor ${timestamp}] Background service recovered - was stopped but now running`
          );
          backgroundLocationStartedRef.current = true;
          sentStopNotificationRef.current = false; // Reset notification flag
        }
      }
    } catch (error: any) {
      logger.error(
        `[Monitor ${timestamp}] Error monitoring background location tracking`,
        {
          error: error.message,
          stack: error.stack,
          appState: AppState.currentState,
        }
      );
      console.error(
        `[DEBUG] Error in monitorBackgroundTracking at ${timestamp}:`,
        error
      );
    }
  }, [verifyBackgroundServiceRunning]);

  // Setup AppState listener to handle app backgrounding/foregrounding
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      logger.debug(`App state changed to: ${nextAppState}`);

      if (nextAppState === "background" || nextAppState === "inactive") {
        // CRITICAL: Verify service is running BEFORE allowing background transition
        // This ensures we catch issues early and can attempt recovery if still in foreground
        console.log(
          "🔍 [DEBUG] App going to background - verifying background location service is running..."
        );

        if (isTrackingRef.current) {
          // Verify service is actually running before going to background
          const isRunning = await verifyBackgroundServiceRunning(2, 500);

          if (!isRunning) {
            logger.warn(
              "⚠️ Background service not running before background transition - attempting recovery"
            );

            // If we're still transitioning (not fully in background), try to restart
            const currentState = AppState.currentState;
            if (currentState === "active" && isActiveRef.current) {
              logger.info(
                "Attempting to restart background service before background transition"
              );
              try {
                await startTracking();
                // Give it a moment to start
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const verified = await verifyBackgroundServiceRunning(2, 500);
                if (verified) {
                  logger.info(
                    "✅ Background service restarted successfully before background transition"
                  );
                } else {
                  logger.error(
                    "❌ Failed to restart background service before background transition"
                  );
                  Toast.show(
                    "Location tracking may not work in background. Please check permissions.",
                    {
                      type: "warning",
                      duration: 4000,
                    }
                  );
                }
              } catch (error: any) {
                logger.error(
                  "Error restarting service before background transition",
                  error
                );
              }
            } else {
              logger.warn(
                "App already in background - cannot restart service. Will recover when returning to foreground."
              );
            }
          } else {
            logger.info(
              "✅ Background service verified as running before background transition"
            );
          }
        }
      } else if (nextAppState === "active") {
        // App came to foreground - immediately check and recover if needed
        logger.debug(
          "App came to foreground - verifying and recovering location tracking if needed"
        );

        if (isTrackingRef.current) {
          // Check battery optimization when returning to foreground
          try {
            await ensureBatteryOptimizationDisabled();
          } catch (error: any) {
            logger.warn("Error checking battery optimization", error);
          }

          // Verify service status
          await monitorBackgroundTracking();

          // If tracking stopped while in background, immediately restart (we're now in foreground)
          const hasStarted = await GeoLocation.hasStartedLocationUpdatesAsync(
            BACKGROUND_LOCATION_TASK
          );

          if (!hasStarted && isActiveRef.current) {
            logger.info(
              "Background location stopped while in background - immediately restarting from foreground"
            );
            Toast.show("Location tracking was stopped. Restarting...", {
              type: "warning",
              duration: 3000,
            });

            // Restart tracking now that we're in foreground with retry logic
            let restartSuccess = false;
            const maxRestartAttempts = 3;

            for (let attempt = 1; attempt <= maxRestartAttempts; attempt++) {
              try {
                // #region agent log
                fetch(
                  "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "useLocationTracking.ts:902",
                      message: "Restart attempt starting",
                      data: {
                        attempt,
                        maxRestartAttempts,
                        appState: AppState.currentState,
                        isActive: isActiveRef.current,
                      },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "run1",
                      hypothesisId: "A",
                    }),
                  }
                ).catch(() => {});
                // #endregion

                logger.info(`Restart attempt ${attempt}/${maxRestartAttempts}`);

                // Check task registration before starting
                let taskRegistered = false;
                if (TaskManager && TaskManager.isTaskRegisteredAsync) {
                  try {
                    taskRegistered = await TaskManager.isTaskRegisteredAsync(
                      BACKGROUND_LOCATION_TASK
                    );
                    // #region agent log
                    fetch(
                      "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          location: "useLocationTracking.ts:910",
                          message: "Task registration check before start",
                          data: { taskRegistered, attempt },
                          timestamp: Date.now(),
                          sessionId: "debug-session",
                          runId: "run1",
                          hypothesisId: "C",
                        }),
                      }
                    ).catch(() => {});
                    // #endregion
                  } catch (err: any) {
                    // #region agent log
                    fetch(
                      "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          location: "useLocationTracking.ts:914",
                          message: "Task registration check error",
                          data: { error: err?.message, attempt },
                          timestamp: Date.now(),
                          sessionId: "debug-session",
                          runId: "run1",
                          hypothesisId: "C",
                        }),
                      }
                    ).catch(() => {});
                    // #endregion
                  }
                }

                // Check permissions before starting
                const permissionStatus = await getLocationPermissionStatus();
                // #region agent log
                fetch(
                  "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "useLocationTracking.ts:920",
                      message: "Permission status before startTracking",
                      data: { permissionStatus, attempt },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "run1",
                      hypothesisId: "D",
                    }),
                  }
                ).catch(() => {});
                // #endregion

                const startTrackingStartTime = Date.now();
                await startTracking();
                const startTrackingDuration =
                  Date.now() - startTrackingStartTime;

                // #region agent log
                fetch(
                  "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "useLocationTracking.ts:927",
                      message: "startTracking completed",
                      data: { duration: startTrackingDuration, attempt },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "run1",
                      hypothesisId: "A",
                    }),
                  }
                ).catch(() => {});
                // #endregion

                // Verify restart was successful
                const waitStartTime = Date.now();
                await new Promise((resolve) => setTimeout(resolve, 1500));
                const waitDuration = Date.now() - waitStartTime;

                // #region agent log
                fetch(
                  "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "useLocationTracking.ts:934",
                      message: "Wait completed before verification",
                      data: { waitDuration, attempt },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "run1",
                      hypothesisId: "A",
                    }),
                  }
                ).catch(() => {});
                // #endregion

                const verifyStartTime = Date.now();
                const verified = await verifyBackgroundServiceRunning(2, 500);
                const verifyDuration = Date.now() - verifyStartTime;

                // #region agent log
                fetch(
                  "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "useLocationTracking.ts:940",
                      message: "Verification result",
                      data: { verified, verifyDuration, attempt },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "run1",
                      hypothesisId: "A",
                    }),
                  }
                ).catch(() => {});
                // #endregion

                if (verified) {
                  restartSuccess = true;
                  logger.info(
                    "✅ Background location service restarted successfully"
                  );
                  Toast.show("Location tracking resumed successfully", {
                    type: "success",
                    duration: 2000,
                  });
                  break;
                } else {
                  logger.warn(`Restart attempt ${attempt} failed verification`);
                  if (attempt < maxRestartAttempts) {
                    await new Promise((resolve) =>
                      setTimeout(resolve, 1000 * attempt)
                    );
                  }
                }
              } catch (error: any) {
                // #region agent log
                fetch(
                  "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "useLocationTracking.ts:960",
                      message: "Error during restart attempt",
                      data: {
                        error: error?.message,
                        code: error?.code,
                        attempt,
                      },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "run1",
                      hypothesisId: "E",
                    }),
                  }
                ).catch(() => {});
                // #endregion
                logger.error(`Error during restart attempt ${attempt}`, error);
                if (attempt < maxRestartAttempts) {
                  await new Promise((resolve) =>
                    setTimeout(resolve, 1000 * attempt)
                  );
                }
              }
            }

            if (!restartSuccess) {
              logger.error(
                "Failed to restart background location service after multiple attempts"
              );
              Toast.show(
                "Failed to restart location tracking. Please toggle online/offline status.",
                {
                  type: "danger",
                  duration: 5000,
                }
              );
            }
          } else if (hasStarted) {
            logger.info(
              "✅ Background location service is running - no recovery needed"
            );
            // Reset notification flag since service is running
            sentStopNotificationRef.current = false;
          }
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
  }, [
    isActive,
    monitorBackgroundTracking,
    verifyBackgroundServiceRunning,
    startTracking,
  ]);

  // Setup periodic monitoring of background location tracking
  useEffect(() => {
    if (!isActive || !isTrackingRef.current) {
      return;
    }

    // Check every 5 seconds if background tracking is still running - frequent checks for faster issue detection
    // This helps catch service stops quickly and enables faster recovery
    monitoringIntervalRef.current = setInterval(() => {
      monitorBackgroundTracking();
    }, 5000);

    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
    };
  }, [isActive, monitorBackgroundTracking]);

  // Setup periodic network check and offline queue flush
  // Note: AppState listener for queue flushing is now consolidated above
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

    return () => {
      if (networkCheckIntervalRef.current) {
        clearInterval(networkCheckIntervalRef.current);
        networkCheckIntervalRef.current = null;
      }
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
