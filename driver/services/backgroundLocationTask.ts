import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getServerUri, getWebSocketUrl } from "@/configs/constants";
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

// Store WebSocket connection reference (will be set by the app)
let wsConnection: WebSocket | null = null;

export function setWebSocketConnection(ws: WebSocket | null) {
  wsConnection = ws;
}

// Send location update to WebSocket
async function sendLocationToWebSocket(location: Location.LocationObject) {
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
    logger.debug(
      "WebSocket not connected in background task - skipping location update"
    );
    return;
  }

  try {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      logger.error(
        "No access token in background task - cannot fetch driver data"
      );
      return;
    }

    const driverResponse = await axios.get(`${getServerUri()}/driver/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (driverResponse.data && driverResponse.data.driver) {
      const driverData = driverResponse.data.driver;
      const driverStatus = driverData.status || "active";

      const message = JSON.stringify({
        type: "locationUpdate",
        data: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading:
            location.coords.heading !== null &&
            location.coords.heading !== undefined &&
            location.coords.heading >= 0
              ? location.coords.heading
              : null,
          name: driverData.name || "Driver",
          status: driverStatus,
          vehicleType: driverData.vehicle_type || "Car",
        },
        role: "driver",
        driver: driverData.id,
      });

      wsConnection.send(message);
      logger.debug("Background location update sent", {
        driverId: driverData.id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    }
  } catch (error: any) {
    logger.error("Error sending background location update", error);
  }
}

// Send location update to server API
async function sendLocationToServer(location: Location.LocationObject) {
  try {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      return;
    }

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
      }
    );
  } catch (error: any) {
    // Non-critical error - might be because driver is offline
    if (
      error.response?.status === 400 &&
      error.response?.data?.message?.includes("online")
    ) {
      logger.debug("Background location update skipped - driver is offline");
    } else {
      logger.warn(
        "Failed to update background location for scheduled trips",
        error
      );
    }
  }
}

// Define the background location task only if TaskManager is available
if (TaskManager && typeof TaskManager.defineTask === "function") {
  try {
    TaskManager.defineTask(
      BACKGROUND_LOCATION_TASK,
      async ({ data, error }) => {
        if (error) {
          logger.error("Background location task error", error);
          return;
        }

        if (data) {
          const { locations } = data as {
            locations: Location.LocationObject[];
          };

          // Process each location update
          for (const location of locations) {
            logger.debug("Background location update", {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading || null,
            });

            // Send to WebSocket
            try {
              await sendLocationToWebSocket(location);
            } catch (error) {
              logger.error(
                "Error sending location to WebSocket in background task",
                error
              );
            }

            // Send to server API
            try {
              await sendLocationToServer(location);
            } catch (error) {
              logger.error(
                "Error sending location to server in background task",
                error
              );
            }
          }
        }
      }
    );
  } catch (error: any) {
    logger.warn("Failed to define background location task", error);
  }
}
// Silently skip if TaskManager is not available - this is expected in some environments
