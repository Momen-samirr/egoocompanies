import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getServerUri, getWebSocketUrl } from "@/configs/constants";

// Conditionally import TaskManager to avoid errors if native module isn't ready
let TaskManager: any = null;
try {
  TaskManager = require("expo-task-manager");
} catch (error) {
  console.warn("⚠️ expo-task-manager not available:", error);
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
    console.log("⚠️ WebSocket not connected in background task - skipping location update");
    return;
  }

  try {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      console.error("❌ No access token in background task - cannot fetch driver data");
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
          heading: location.coords.heading !== null && location.coords.heading !== undefined && location.coords.heading >= 0 
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
      console.log(`✅ Background location update sent: Driver=${driverData.id}, Lat=${location.coords.latitude}, Lng=${location.coords.longitude}`);
    }
  } catch (error: any) {
    console.error("❌ Error sending background location update:", error);
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
    if (error.response?.status === 400 && error.response?.data?.message?.includes("online")) {
      console.log("⚠️ Background location update skipped - driver is offline");
    } else {
      console.log("⚠️ Failed to update background location for scheduled trips:", error.message);
    }
  }
}

// Define the background location task only if TaskManager is available
if (TaskManager && TaskManager.defineTask) {
  try {
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
      if (error) {
        console.error("❌ Background location task error:", error);
        return;
      }

      if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        
        // Process each location update
        for (const location of locations) {
          console.log(`📍 Background location update: Lat=${location.coords.latitude}, Lng=${location.coords.longitude}, Heading=${location.coords.heading || 'N/A'}`);
          
          // Send to WebSocket
          await sendLocationToWebSocket(location);
          
          // Send to server API
          await sendLocationToServer(location);
        }
      }
    });
  } catch (error) {
    console.warn("⚠️ Failed to define background location task:", error);
  }
} else {
  console.warn("⚠️ TaskManager not available - background location task not registered");
}

