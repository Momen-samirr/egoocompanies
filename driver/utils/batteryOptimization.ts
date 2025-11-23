import { Platform, Alert, Linking, AppState, AppStateStatus } from "react-native";
import { Toast } from "react-native-toast-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Check if battery optimization is enabled for this app
 * Note: This requires native module support. For now, we'll provide
 * instructions to the user to manually disable it.
 */
export async function checkBatteryOptimization(): Promise<boolean> {
  // On iOS, battery optimization is less of an issue
  if (Platform.OS === "ios") {
    return false; // Assume not optimized (iOS handles this better)
  }

  // On Android, we can't directly check without a native module
  // But we can prompt the user to check and disable it
  // For a full implementation, you'd need to use a library like:
  // react-native-disable-battery-optimizations or similar
  
  return false; // We'll assume it might be enabled and prompt the user
}

/**
 * Request user to disable battery optimization
 * This is critical for background location tracking to work reliably
 */
export function promptDisableBatteryOptimization(): void {
  if (Platform.OS !== "android") {
    return; // Only relevant for Android
  }

  Alert.alert(
    "Battery Optimization",
    "To ensure location updates work when your screen is off, please disable battery optimization for this app. This will allow the app to continue tracking your location in the background.",
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Open Settings",
        onPress: () => {
          // Open battery optimization settings
          // The exact intent varies by Android version and manufacturer
          try {
            Linking.openSettings();
            Toast.show("Please find 'Battery' or 'Battery Optimization' and set this app to 'Not optimized'", {
              type: "info",
              duration: 5000,
            });
          } catch (error) {
            console.error("Error opening settings:", error);
            Toast.show("Please go to Settings > Battery > Battery Optimization and disable it for this app", {
              type: "info",
              duration: 5000,
            });
          }
        },
      },
    ]
  );
}

/**
 * Show instructions for disabling battery optimization
 * This can be called when location updates stop working
 */
export function showBatteryOptimizationInstructions(): void {
  if (Platform.OS !== "android") {
    return;
  }

  Alert.alert(
    "Battery Optimization Instructions",
    "To ensure location tracking works when your screen is off:\n\n" +
      "1. Go to Settings > Apps > [This App]\n" +
      "2. Tap on 'Battery' or 'Power'\n" +
      "3. Select 'Battery Optimization' or 'Unrestricted'\n" +
      "4. Find this app and set it to 'Not optimized' or 'Don't optimize'\n\n" +
      "Note: Steps may vary slightly depending on your device manufacturer.",
    [
      { text: "OK" },
      {
        text: "Open Settings",
        onPress: () => Linking.openSettings(),
      },
    ]
  );
}

/**
 * Check and prompt for battery optimization if needed
 * Call this when starting location tracking
 */
export async function ensureBatteryOptimizationDisabled(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  // Check if we've already prompted recently (within last 24 hours)
  const lastPromptTime = await AsyncStorage.getItem("batteryOptLastPrompt");
  const now = Date.now();
  const oneDayInMs = 24 * 60 * 60 * 1000;

  if (lastPromptTime) {
    const timeSinceLastPrompt = now - parseInt(lastPromptTime, 10);
    if (timeSinceLastPrompt < oneDayInMs) {
      // Already prompted within last 24 hours, skip
      return;
    }
  }

  // Show prompt and save timestamp
  promptDisableBatteryOptimization();
  await AsyncStorage.setItem("batteryOptLastPrompt", now.toString());
}

/**
 * Setup periodic battery optimization checks
 * Checks when app comes to foreground and driver is active
 */
let appStateSubscription: any = null;
let checkInterval: NodeJS.Timeout | null = null;

export function setupPeriodicBatteryOptimizationCheck(
  isDriverActive: () => boolean,
  checkIntervalMinutes: number = 60 // Check every hour
): void {
  if (Platform.OS !== "android") {
    return;
  }

  // Clean up existing subscriptions
  cleanupPeriodicBatteryOptimizationCheck();

  // Check when app comes to foreground
  appStateSubscription = AppState.addEventListener("change", async (nextAppState: AppStateStatus) => {
    if (nextAppState === "active" && isDriverActive()) {
      // Wait a bit before checking to avoid interrupting user
      setTimeout(() => {
        ensureBatteryOptimizationDisabled();
      }, 5000); // 5 seconds delay
    }
  });

  // Periodic check while app is active
  checkInterval = setInterval(() => {
    if (isDriverActive() && AppState.currentState === "active") {
      ensureBatteryOptimizationDisabled();
    }
  }, checkIntervalMinutes * 60 * 1000);
}

/**
 * Clean up periodic battery optimization checks
 */
export function cleanupPeriodicBatteryOptimizationCheck(): void {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

