import {
  Platform,
  Alert,
  Linking,
  AppState,
  AppStateStatus,
} from "react-native";
import { Toast } from "react-native-toast-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { i18n } from "@/lib/i18n/instance";

const tl = (key: string) => i18n.t(key, { ns: "location" });
const tp = (key: string) => i18n.t(key, { ns: "permissions" });

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
    tl("batteryOptTitle"),
    tl("batteryOptMessage"),
    [
      {
        text: i18n.t("cancel", { ns: "common" }),
        style: "cancel",
      },
      {
        text: tp("openSettings"),
        onPress: () => {
          // Open battery optimization settings
          // The exact intent varies by Android version and manufacturer
          try {
            Linking.openSettings();
            Toast.show(
              tl("batteryToastAfterOpen"),
              {
                type: "info",
                duration: 5000,
              }
            );
          } catch (error) {
            console.error("Error opening settings:", error);
            Toast.show(
              tl("batteryToastManualPath"),
              {
                type: "info",
                duration: 5000,
              }
            );
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
    tl("batteryInstructionsTitle"),
    tl("batteryInstructionsBody"),
    [
      { text: i18n.t("ok", { ns: "common" }) },
      {
        text: tp("openSettings"),
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
  appStateSubscription = AppState.addEventListener(
    "change",
    async (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && isDriverActive()) {
        // Wait a bit before checking to avoid interrupting user
        setTimeout(() => {
          ensureBatteryOptimizationDisabled();
        }, 5000); // 5 seconds delay
      }
    }
  );

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
