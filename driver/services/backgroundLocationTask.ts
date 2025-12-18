import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getServerUri } from "@/configs/constants";
import { logger } from "@/lib/logger";

// Conditionally import TaskManager to avoid errors if native module isn't ready
let TaskManager: any = null;
try {
  const taskManagerModule = require("expo-task-manager");
  if (taskManagerModule && typeof taskManagerModule.defineTask === "function") {
    TaskManager = taskManagerModule;
  }
} catch (error) {
  // TaskManager not available - this is expected in some environments
}

// Task name for background location tracking
export const BACKGROUND_LOCATION_TASK = "background-location-tracking";

/**
 * Check if driver is active and should send location updates
 */
async function isDriverActive(): Promise<boolean> {
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "backgroundLocationTask.ts:24",
      message: "isDriverActive called",
      data: {},
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "E",
    }),
  }).catch(() => {});
  // #endregion
  try {
    const status = await AsyncStorage.getItem("status");
    const isActive = status === "active";
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "backgroundLocationTask.ts:29",
        message: "isDriverActive result",
        data: { status, isActive },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
    return isActive;
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "backgroundLocationTask.ts:32",
        message: "isDriverActive error",
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
    logger.error("Error checking driver status in background task", error);
    return false;
  }
}

/**
 * Send location update to server API with retry logic
 * This is the only method used in background tasks (WebSocket doesn't work in background)
 */
async function sendLocationToServer(
  location: Location.LocationObject,
  retryCount: number = 0
): Promise<void> {
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "backgroundLocationTask.ts:38",
      message: "sendLocationToServer called",
      data: {
        retryCount,
        lat: location.coords?.latitude,
        lng: location.coords?.longitude,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff in ms

  const updateStartTime = Date.now();

  try {
    // Check if driver is active before sending
    const driverActive = await isDriverActive();
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "backgroundLocationTask.ts:50",
        message: "Driver active check result",
        data: { driverActive },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "B,E",
      }),
    }).catch(() => {});
    // #endregion
    if (!driverActive) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "backgroundLocationTask.ts:52",
            message: "Early exit - driver not active",
            data: {},
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "E",
          }),
        }
      ).catch(() => {});
      // #endregion
      logger.debug(
        "[Background] Driver is not active - skipping background location update"
      );
      return;
    }

    const accessToken = await AsyncStorage.getItem("accessToken");
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "backgroundLocationTask.ts:58",
        message: "Access token check",
        data: {
          hasToken: !!accessToken,
          tokenLength: accessToken?.length || 0,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "F",
      }),
    }).catch(() => {});
    // #endregion
    if (!accessToken) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "backgroundLocationTask.ts:60",
            message: "Early exit - no access token",
            data: {},
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "F",
          }),
        }
      ).catch(() => {});
      // #endregion
      logger.warn(
        "[Background] No access token in background task - skipping location update"
      );
      return;
    }

    logger.info("[Background] Sending location update via HTTP API", {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      heading: location.coords.heading ?? null,
      accuracy: location.coords.accuracy ?? null,
      speed: location.coords.speed ?? null,
      retryAttempt: retryCount,
      timestamp: new Date().toISOString(),
    });

    // IMPORTANT: This HTTP API call now triggers socket server notification
    // via the backend controller, ensuring dashboard continues to see driver
    // even when WebSocket is disconnected (which happens when app is in background)
    const serverUri = getServerUri();
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "backgroundLocationTask.ts:79",
        message: "Starting HTTP request",
        data: { url: `${serverUri}/driver/update-location`, retryCount },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
    const response = await axios.post(
      `${serverUri}/driver/update-location`,
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading:
          location.coords.heading !== undefined
            ? location.coords.heading
            : null,
        accuracy:
          location.coords.accuracy !== undefined
            ? location.coords.accuracy
            : null,
        speed:
          location.coords.speed !== undefined ? location.coords.speed : null,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15000, // 15 second timeout - increased for background requests
      }
    );

    const updateLatency = Date.now() - updateStartTime;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "backgroundLocationTask.ts:103",
        message: "HTTP request success",
        data: { status: response.status, latency: updateLatency },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
    logger.info("[Background] Location update sent successfully via HTTP", {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      heading: location.coords.heading ?? null,
      accuracy: location.coords.accuracy ?? null,
      speed: location.coords.speed ?? null,
      latency: `${updateLatency}ms`,
      status: response.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const updateLatency = Date.now() - updateStartTime;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "backgroundLocationTask.ts:114",
        message: "HTTP request error",
        data: {
          error: error.message,
          code: error.code,
          status: error.response?.status,
          retryCount,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion

    // Handle specific error cases
    if (
      error.response?.status === 400 &&
      error.response?.data?.message?.includes("online")
    ) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "backgroundLocationTask.ts:122",
            message: "Early exit - driver offline (400)",
            data: {},
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "C",
          }),
        }
      ).catch(() => {});
      // #endregion
      logger.debug(
        "[Background] Location update skipped - driver is offline (not active)"
      );
      return;
    }

    // Determine if error is retryable
    const isNetworkError =
      !error.response ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ENOTFOUND" ||
      error.code === "ECONNREFUSED" ||
      error.message?.includes("Network Error") ||
      error.message?.includes("timeout");
    const isServerError =
      error.response?.status >= 500 && error.response?.status < 600;
    const isRetryable = isNetworkError || isServerError;

    // Retry on network errors or 5xx server errors
    if (retryCount < MAX_RETRIES && isRetryable) {
      const delay = RETRY_DELAYS[retryCount] || 4000;
      logger.warn(
        `[Background] Location update failed (retryable error), retrying in ${delay}ms (attempt ${
          retryCount + 1
        }/${MAX_RETRIES})`,
        {
          errorType: isNetworkError ? "network" : "server",
          errorCode: error.code,
          status: error.response?.status,
          message: error.message,
          latency: `${updateLatency}ms`,
        }
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Recursive retry
      return sendLocationToServer(location, retryCount + 1);
    }

    // Log error if all retries failed or it's a non-retryable error
    if (retryCount >= MAX_RETRIES) {
      logger.error("[Background] Failed to update location after all retries", {
        error: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        latency: `${updateLatency}ms`,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      });
    } else {
      logger.warn(
        "[Background] Failed to update location (non-retryable error)",
        {
          error: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          latency: `${updateLatency}ms`,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
        }
      );
    }
  }
}

/**
 * Define the background location task
 * This task runs even when the app is in the background or screen is off
 * WebSocket connections are not available in background, so we only use HTTP API
 */
if (TaskManager && typeof TaskManager.defineTask === "function") {
  try {
    TaskManager.defineTask(
      BACKGROUND_LOCATION_TASK,
      async ({ data, error }) => {
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "backgroundLocationTask.ts:206",
              message: "Background task handler called",
              data: { hasError: !!error, hasData: !!data },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "A",
            }),
          }
        ).catch(() => {});
        // #endregion
        if (error) {
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "backgroundLocationTask.ts:208",
                message: "Background task error",
                data: { error: error.message, code: error.code },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "A",
              }),
            }
          ).catch(() => {});
          // #endregion
          logger.error("[Background Task] Task execution error", {
            error: error.message,
            code: error.code,
            stack: error.stack,
          });
          return;
        }

        if (!data) {
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "backgroundLocationTask.ts:217",
                message: "No data in task",
                data: {},
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "A",
              }),
            }
          ).catch(() => {});
          // #endregion
          logger.warn("[Background Task] Received task execution with no data");
          return;
        }

        const { locations } = data as {
          locations: Location.LocationObject[];
        };

        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "backgroundLocationTask.ts:225",
              message: "Locations extracted",
              data: { locationCount: locations?.length || 0 },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "A",
            }),
          }
        ).catch(() => {});
        // #endregion
        if (!locations || locations.length === 0) {
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "backgroundLocationTask.ts:227",
                message: "Early exit - no locations",
                data: {},
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "A",
              }),
            }
          ).catch(() => {});
          // #endregion
          logger.debug("[Background Task] No locations in data payload");
          return;
        }

        // Process each location update
        logger.info(
          `[Background Task] Received ${locations.length} location update(s)`
        );

        for (const location of locations) {
          try {
            // Validate location data
            if (
              !location.coords ||
              typeof location.coords.latitude !== "number" ||
              typeof location.coords.longitude !== "number"
            ) {
              logger.warn(
                "[Background Task] Invalid location data received - skipping",
                {
                  hasCoords: !!location.coords,
                  latitudeType: typeof location.coords?.latitude,
                  longitudeType: typeof location.coords?.longitude,
                  rawData: location,
                }
              );
              continue;
            }

            logger.info("[Background Task] Processing location update", {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading ?? null,
              accuracy: location.coords.accuracy ?? null,
              speed: location.coords.speed ?? null,
              timestamp: location.timestamp
                ? new Date(location.timestamp).toISOString()
                : null,
            });

            // Send to server API (WebSocket is not available in background)
            // This HTTP call will trigger the backend to notify socket server,
            // ensuring dashboard continues to see driver location even when
            // WebSocket connection is closed (which happens in background)
            // #region agent log
            fetch(
              "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "backgroundLocationTask.ts:270",
                  message: "Calling sendLocationToServer",
                  data: {
                    lat: location.coords?.latitude,
                    lng: location.coords?.longitude,
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "run1",
                  hypothesisId: "B",
                }),
              }
            ).catch(() => {});
            // #endregion
            await sendLocationToServer(location);
            // #region agent log
            fetch(
              "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "backgroundLocationTask.ts:272",
                  message: "sendLocationToServer completed",
                  data: {},
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "run1",
                  hypothesisId: "B",
                }),
              }
            ).catch(() => {});
            // #endregion
          } catch (error: any) {
            logger.error("[Background Task] Error processing location update", {
              error: error.message,
              stack: error.stack,
              location: {
                latitude: location.coords?.latitude,
                longitude: location.coords?.longitude,
              },
            });
            // Continue processing other locations even if one fails
          }
        }

        logger.debug(
          `[Background Task] Finished processing ${locations.length} location update(s)`
        );
      }
    );

    logger.info("Background location task registered successfully");
  } catch (error: any) {
    logger.error("Failed to define background location task", error);
  }
} else {
  logger.warn(
    "TaskManager not available - background location tracking will not work"
  );
}

/**
 * Export function to check if task is registered
 * This is used to verify the task is ready before starting location updates
 */
export async function isBackgroundLocationTaskRegistered(): Promise<boolean> {
  if (!TaskManager || !TaskManager.isTaskRegisteredAsync) {
    return false;
  }

  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  } catch (error) {
    logger.error(
      "Error checking if background location task is registered",
      error
    );
    return false;
  }
}

/**
 * No-op function for backward compatibility
 * WebSocket connections don't work in background tasks, so this is not used
 * but kept to avoid breaking existing code that calls it
 */
export function setWebSocketConnection(_ws: WebSocket | null): void {
  // WebSocket is not used in background tasks as connections close when app is backgrounded
  // This function is kept for backward compatibility but does nothing
}
