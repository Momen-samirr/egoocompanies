import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { Coordinate } from "@/services/navigationService";

// Task name for navigation background location tracking
const NAVIGATION_LOCATION_TASK = "navigation-location-tracking";

export interface BackgroundLocationOptions {
  onLocationUpdate: (location: Coordinate) => void;
  accuracy?: Location.Accuracy;
  timeInterval?: number; // milliseconds
  distanceInterval?: number; // meters
}

export interface BackgroundLocationService {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}

/**
 * Enhanced background location service for navigation
 * Maintains location updates even when app is backgrounded
 */
class BackgroundLocationServiceImpl implements BackgroundLocationService {
  private subscription: Location.LocationSubscription | null = null;
  private taskName = NAVIGATION_LOCATION_TASK;
  private isActive = false;
  private options: BackgroundLocationOptions;
  private taskRegistered = false;

  constructor(options: BackgroundLocationOptions) {
    this.options = {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000, // 5 seconds
      distanceInterval: 10, // 10 meters
      ...options,
    };
  }

  async start(): Promise<void> {
    if (this.isActive) {
      console.log("⚠️ Background location service already running");
      return;
    }

    try {
      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== "granted") {
        throw new Error("Foreground location permission denied");
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== "granted") {
        console.warn("⚠️ Background location permission not granted. Navigation may not work when screen is off.");
      }

      // Register task if not already registered
      if (!this.taskRegistered) {
        try {
          const isRegistered = await TaskManager.isTaskRegisteredAsync(this.taskName);
          if (!isRegistered) {
            TaskManager.defineTask(this.taskName, ({ data, error }) => {
              if (error) {
                console.error("❌ Navigation location task error:", error);
                return;
              }
              if (data) {
                const { locations } = data as { locations: Location.LocationObject[] };
                for (const location of locations) {
                  const coordinate: Coordinate = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  };
                  this.options.onLocationUpdate(coordinate);
                }
              }
            });
            this.taskRegistered = true;
          }
        } catch (error) {
          console.error("❌ Error registering navigation location task:", error);
        }
      }

      // Start background location updates using task manager
      await Location.startLocationUpdatesAsync(this.taskName, {
        accuracy: this.options.accuracy || Location.Accuracy.High,
        timeInterval: this.options.timeInterval || 5000,
        distanceInterval: this.options.distanceInterval || 10,
        foregroundService: {
          notificationTitle: "Navigation Active",
          notificationBody: "Tracking your location for navigation",
          notificationColor: "#10B981",
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      // Also set up a foreground watcher for immediate UI updates
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: this.options.accuracy || Location.Accuracy.High,
          timeInterval: this.options.timeInterval || 5000,
          distanceInterval: this.options.distanceInterval || 10,
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          const coordinate: Coordinate = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          this.options.onLocationUpdate(coordinate);
        }
      );

      this.isActive = true;
      console.log("✅ Background location service started");
    } catch (error: any) {
      console.error("❌ Error starting background location service:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    // Stop foreground watcher
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    // Stop background location updates
    try {
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(this.taskName);
      if (isTaskRegistered) {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(this.taskName);
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(this.taskName);
          console.log("🛑 Navigation background location tracking stopped");
        }
      }
    } catch (error: any) {
      console.error("❌ Error stopping navigation background location tracking:", error);
    }

    this.isActive = false;
    console.log("🛑 Background location service stopped");
  }

  isRunning(): boolean {
    return this.isActive;
  }
}

/**
 * Create a background location service instance
 */
export function createBackgroundLocationService(
  options: BackgroundLocationOptions
): BackgroundLocationService {
  return new BackgroundLocationServiceImpl(options);
}

/**
 * Request all necessary location permissions
 */
export async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  const background = await Location.requestBackgroundPermissionsAsync();

  return {
    foreground: foreground.status === "granted",
    background: background.status === "granted",
  };
}

/**
 * Check current location permission status
 */
export async function checkLocationPermissions(): Promise<{
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
}> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return {
    foreground: foreground.status,
    background: background.status,
  };
}

