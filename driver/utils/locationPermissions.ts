import * as Location from "expo-location";
import { Platform, Alert, Linking } from "react-native";

/**
 * Request foreground location permissions
 */
export async function requestForegroundLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("Error requesting foreground location permission:", error);
    return false;
  }
}

/**
 * Request background location permissions
 * On Android 10+ (API 29+), this requires a separate permission request
 * On iOS, this is handled through the "Always" permission option
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      // Check Android version - background location requires API 29+
      const androidVersion = Platform.Version;
      if (typeof androidVersion === "number" && androidVersion < 29) {
        // Android 9 and below don't have separate background permission
        console.log("Android version < 10, background permission not required");
        return true;
      }

      // First check if foreground permission is granted
      const foregroundStatus = await Location.getForegroundPermissionsAsync();
      if (foregroundStatus.status !== "granted") {
        console.log("Foreground permission not granted, requesting it first...");
        const foregroundGranted = await requestForegroundLocationPermission();
        if (!foregroundGranted) {
          Alert.alert(
            "Location Permission Required",
            "Please grant location permission to use this app.",
            [{ text: "OK" }]
          );
          return false;
        }
      }

      // Request background permission
      const { status } = await Location.requestBackgroundPermissionsAsync();
      
      if (status === "granted") {
        console.log("✅ Background location permission granted");
        return true;
      } else {
        console.warn("⚠️ Background location permission denied:", status);
        Alert.alert(
          "Background Location Required",
          "This app needs background location access to track your location when the screen is off. Please enable it in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return false;
      }
    } else {
      // iOS - request "Always" permission
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === "granted";
    }
  } catch (error) {
    console.error("Error requesting background location permission:", error);
    return false;
  }
}

/**
 * Check if background location permission is granted
 */
export async function hasBackgroundLocationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      const androidVersion = Platform.Version;
      if (typeof androidVersion === "number" && androidVersion < 29) {
        // Android 9 and below - check foreground permission
        const { status } = await Location.getForegroundPermissionsAsync();
        return status === "granted";
      }

      const { status } = await Location.getBackgroundPermissionsAsync();
      return status === "granted";
    } else {
      // iOS
      const { status } = await Location.getBackgroundPermissionsAsync();
      return status === "granted";
    }
  } catch (error) {
    console.error("Error checking background location permission:", error);
    return false;
  }
}

/**
 * Request all required location permissions (foreground + background)
 * This is the main function to call when setting up location tracking
 */
export async function requestAllLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  console.log("📍 Requesting location permissions...");

  // Step 1: Request foreground permission
  const foregroundGranted = await requestForegroundLocationPermission();
  if (!foregroundGranted) {
    return { foreground: false, background: false };
  }

  // Step 2: Request background permission
  const backgroundGranted = await requestBackgroundLocationPermission();

  return {
    foreground: foregroundGranted,
    background: backgroundGranted,
  };
}

/**
 * Get current permission status
 */
export async function getLocationPermissionStatus(): Promise<{
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus | null;
}> {
  try {
    const foreground = await Location.getForegroundPermissionsAsync();
    let background: Location.PermissionResponse | null = null;

    if (Platform.OS === "android") {
      const androidVersion = Platform.Version;
      if (typeof androidVersion === "number" && androidVersion >= 29) {
        background = await Location.getBackgroundPermissionsAsync();
      }
    } else {
      background = await Location.getBackgroundPermissionsAsync();
    }

    return {
      foreground: foreground.status,
      background: background?.status || null,
    };
  } catch (error) {
    console.error("Error getting location permission status:", error);
    return {
      foreground: "undetermined",
      background: null,
    };
  }
}

