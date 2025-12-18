import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as FileSystem from "expo-file-system";
import { getServerUri } from "@/configs/constants";
import { logger } from "@/lib/logger";

// Standard import ensures this runs at module load time!
console.log("[backgroundLocationTask] Module loading...");

export const BACKGROUND_LOCATION_TASK = "background-location-tracking";

// Debug logging helper
const DEBUG_LOG_PATH = `${FileSystem.documentDirectory}debug.log`;
async function debugLog(
  location: string,
  message: string,
  data: any,
  hypothesisId: string
) {
  // Keep debug logging for now as it helps with troubleshooting
  console.log(`[DEBUG ${hypothesisId}] ${location}: ${message}`, data);
  try {
    const logEntry = {
      timestamp: Date.now(),
      location,
      message,
      data,
      hypothesisId,
    };
    const logLine = JSON.stringify(logEntry) + "\n";
    // Optimistic write - don't await check to keep it fast
    // In a real app we might want to be more careful, but this is debug code
    await FileSystem.writeAsStringAsync(DEBUG_LOG_PATH, logLine, {
      encoding: FileSystem.EncodingType.UTF8,
      append: true,
    }).catch(async () => {
      // If append failed (file doesn't exist?), try write
      await FileSystem.writeAsStringAsync(DEBUG_LOG_PATH, logLine, {
        encoding: FileSystem.EncodingType.UTF8,
      }).catch(() => {});
    });
  } catch (error) {
    // Silently fail logging
  }
}

// Check if driver is active
async function isDriverActive(): Promise<boolean> {
  try {
    const status = await AsyncStorage.getItem("status");
    return status === "active";
  } catch (error) {
    logger.error("Error checking driver status", error);
    return false;
  }
}

// Send location to server
export async function sendLocationToServer(
  location: Location.LocationObject,
  retryCount: number = 0
): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000];

  try {
    const driverActive = await isDriverActive();
    if (!driverActive) {
      logger.debug("[Background] Driver inactive, skipping update");
      return;
    }

    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      logger.warn("[Background] No access token");
      return;
    }

    const serverUri = getServerUri();
    await axios.post(
      `${serverUri}/driver/update-location`,
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading ?? null,
        accuracy: location.coords.accuracy ?? null,
        speed: location.coords.speed ?? null,
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );

    logger.info("[Background] Location update sent", {
      timestamp: new Date().toISOString(),
      coords: location.coords,
    });
  } catch (error: any) {
    // Enhanced error handling with detailed logging
    const isNetworkError =
      !error.response ||
      error.code === "ECONNABORTED" ||
      error.code === "NETWORK_ERROR" ||
      error.message?.includes("Network Error") ||
      error.message?.includes("timeout") ||
      error.message?.includes("ECONNREFUSED");

    const isAuthError =
      error.response?.status === 401 || error.response?.status === 403;
    const isServerError = error.response?.status >= 500;

    // Retry on network errors only
    if (retryCount < MAX_RETRIES && isNetworkError) {
      const delay = RETRY_DELAYS[retryCount];
      logger.debug(
        `[Background] Retrying location send (attempt ${
          retryCount + 1
        }/${MAX_RETRIES}) after ${delay}ms`,
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendLocationToServer(location, retryCount + 1);
    }

    // Log error with context but don't throw - allow task to continue
    if (isAuthError) {
      logger.warn(
        "[Background] Authentication error sending location - token may be invalid",
        {
          status: error.response?.status,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }
      );
    } else if (isServerError) {
      logger.warn(
        "[Background] Server error sending location - server may be unavailable",
        {
          status: error.response?.status,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          retryCount,
        }
      );
    } else if (isNetworkError) {
      logger.warn(
        "[Background] Network error sending location - max retries reached",
        {
          error: error.message,
          code: error.code,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          retryCount,
        }
      );
    } else {
      logger.error("[Background] Failed to send location", {
        error: error.message || String(error),
        code: error.code,
        status: error.response?.status,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        retryCount,
      });
    }

    // Don't throw - let the task continue processing other locations
  }
}

// DEFINE TASK IMMEDIATELY
// Enhanced error handling ensures the task continues running even if individual location sends fail
try {
  console.log(
    `[backgroundLocationTask] Defining task: ${BACKGROUND_LOCATION_TASK}`
  );
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    const taskStartTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Handle task-level errors (e.g., permission issues, service errors)
      if (error) {
        logger.error(`[Background Task ${timestamp}] Task error occurred`, {
          error: error.message || String(error),
          errorCode: (error as any)?.code,
          stack: (error as any)?.stack,
        });
        // Don't throw - allow task to continue running
        return;
      }

      // Process location data
      if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };

        if (!locations || locations.length === 0) {
          logger.debug(`[Background Task ${timestamp}] No locations received`);
          return;
        }

        logger.info(
          `[Background Task ${timestamp}] Processing ${locations.length} location(s)`,
          {
            locationCount: locations.length,
          }
        );

        // Process each location independently - if one fails, continue with others
        const results = await Promise.allSettled(
          locations.map(async (location, index) => {
            try {
              logger.debug(
                `[Background Task ${timestamp}] Processing location ${
                  index + 1
                }/${locations.length}`,
                {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  accuracy: location.coords.accuracy,
                  timestamp: location.timestamp,
                }
              );

              await sendLocationToServer(location);

              logger.debug(
                `[Background Task ${timestamp}] Successfully processed location ${
                  index + 1
                }`
              );
              return { success: true, index };
            } catch (locationError: any) {
              // Individual location send failed - log but don't crash task
              logger.warn(
                `[Background Task ${timestamp}] Failed to process location ${
                  index + 1
                }`,
                {
                  error: locationError.message || String(locationError),
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  index,
                }
              );
              return { success: false, index, error: locationError.message };
            }
          })
        );

        // Log summary of processing results
        const successful = results.filter(
          (r) => r.status === "fulfilled" && r.value.success
        ).length;
        const failed = results.length - successful;

        if (failed > 0) {
          logger.warn(
            `[Background Task ${timestamp}] Processed ${locations.length} locations: ${successful} succeeded, ${failed} failed`
          );
        } else {
          logger.info(
            `[Background Task ${timestamp}] Successfully processed all ${locations.length} location(s)`
          );
        }

        const processingTime = Date.now() - taskStartTime;
        logger.debug(
          `[Background Task ${timestamp}] Task completed in ${processingTime}ms`
        );
      } else {
        logger.debug(`[Background Task ${timestamp}] No data received in task`);
      }
    } catch (taskError: any) {
      // Catch-all for any unexpected errors - ensure task doesn't crash
      logger.error(
        `[Background Task ${timestamp}] Unexpected error in task handler`,
        {
          error: taskError.message || String(taskError),
          stack: taskError.stack,
          taskStartTime,
        }
      );
      // Don't rethrow - allow task to continue running for future location updates
    }
  });
  console.log(`[backgroundLocationTask] Task defined successfully`);
  logger.info("Background location task registered and ready");
} catch (error) {
  console.error("[backgroundLocationTask] Failed to define task:", error);
  logger.error("CRITICAL: Failed to define background location task", {
    error: (error as any)?.message || String(error),
    stack: (error as any)?.stack,
  });
}

export async function isBackgroundLocationTaskRegistered(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  } catch (error) {
    console.error("Error checking task registration:", error);
    return false;
  }
}

// Backward compatibility/placeholder
export function setWebSocketConnection(_ws: any) {}
