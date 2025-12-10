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
  try {
    const status = await AsyncStorage.getItem("status");
    return status === "active";
  } catch (error) {
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
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff in ms

  try {
    // Check if driver is active before sending
    const driverActive = await isDriverActive();
    if (!driverActive) {
      logger.debug(
        "Driver is not active - skipping background location update"
      );
      return;
    }

    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      logger.debug(
        "No access token in background task - skipping location update"
      );
      return;
    }

    // IMPORTANT: This HTTP API call now triggers socket server notification
    // via the backend controller, ensuring dashboard continues to see driver
    await axios.post(
      `${getServerUri()}/driver/update-location`,
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15000, // 15 second timeout - increased for background requests
      }
    );

    logger.debug("Background location update sent successfully", {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
  } catch (error: any) {
    // Handle specific error cases
    if (
      error.response?.status === 400 &&
      error.response?.data?.message?.includes("online")
    ) {
      logger.debug("Background location update skipped - driver is offline");
      return;
    }

    // Retry on network errors or 5xx server errors
    if (
      retryCount < MAX_RETRIES &&
      (!error.response ||
        (error.response.status >= 500 && error.response.status < 600))
    ) {
      const delay = RETRY_DELAYS[retryCount] || 4000;
      logger.warn(
        `Background location update failed, retrying in ${delay}ms (attempt ${
          retryCount + 1
        }/${MAX_RETRIES})`,
        error.message
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Recursive retry
      return sendLocationToServer(location, retryCount + 1);
    }

    // Log error if all retries failed or it's a non-retryable error
    if (retryCount >= MAX_RETRIES) {
      logger.error(
        "Failed to update background location after all retries",
        error
      );
    } else {
      logger.warn(
        "Failed to update background location (non-retryable error)",
        {
          status: error.response?.status,
          message: error.message,
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
        if (error) {
          logger.error("Background location task error", error);
          return;
        }

        if (!data) {
          return;
        }

        const { locations } = data as {
          locations: Location.LocationObject[];
        };

        if (!locations || locations.length === 0) {
          return;
        }

        // Process each location update
        for (const location of locations) {
          try {
            // Validate location data
            if (
              !location.coords ||
              typeof location.coords.latitude !== "number" ||
              typeof location.coords.longitude !== "number"
            ) {
              logger.warn(
                "Invalid location data received in background task",
                location
              );
              continue;
            }

            logger.debug("Background location update received", {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading || null,
              accuracy: location.coords.accuracy || null,
            });

            // Send to server API (WebSocket is not available in background)
            await sendLocationToServer(location);
          } catch (error: any) {
            logger.error("Error processing background location update", error);
            // Continue processing other locations even if one fails
          }
        }
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
