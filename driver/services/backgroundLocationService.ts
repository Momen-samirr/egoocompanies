import * as Location from "expo-location";
import { Platform } from "react-native";
import { Coordinate } from "@/services/navigationService";

export interface BackgroundLocationOptions {
  onLocationUpdate: (location: Coordinate) => void;
  accuracy?: Location.Accuracy;
  timeInterval?: number; // milliseconds
  distanceInterval?: number; // meters
}

export interface BackgroundLocationService {
  start: () => Promise<void>;
  stop: () => void;
  isRunning: () => boolean;
}

/**
 * Enhanced background location service for navigation
 * Maintains location updates even when app is backgrounded
 */
class BackgroundLocationServiceImpl implements BackgroundLocationService {
  private subscription: Location.LocationSubscription | null = null;
  private taskName = "background-location-tracking";
  private isActive = false;
  private options: BackgroundLocationOptions;

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

      // For Android, we need to use a foreground service
      if (Platform.OS === "android") {
        // Start location tracking with high accuracy
        this.subscription = await Location.watchPositionAsync(
          {
            accuracy: this.options.accuracy || Location.Accuracy.High,
            timeInterval: this.options.timeInterval || 5000,
            distanceInterval: this.options.distanceInterval || 10,
            mayShowUserSettingsDialog: true,
            // Enable background location updates
            foregroundService: {
              notificationTitle: "Navigation Active",
              notificationBody: "Tracking your location for navigation",
            },
          },
          (location) => {
            const coordinate: Coordinate = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
            this.options.onLocationUpdate(coordinate);
          }
        );
      } else {
        // iOS - use standard watchPositionAsync
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
      }

      this.isActive = true;
      console.log("✅ Background location service started");
    } catch (error: any) {
      console.error("❌ Error starting background location service:", error);
      throw error;
    }
  }

  stop(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
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

