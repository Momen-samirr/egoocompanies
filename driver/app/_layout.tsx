import React, { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";
import { Stack } from "expo-router";
import { ToastProvider } from "react-native-toast-notifications";
import { LogBox } from "react-native";
import { useFonts } from "expo-font";
import { DriverProvider } from "@/contexts/DriverContext";
import { TripActivationProvider } from "@/contexts/TripActivationContext";
import { I18nActionsProvider } from "@/contexts/I18nActionsContext";
import OfflineIndicator from "@/components/common/OfflineIndicator";
import { logger } from "@/lib/logger";
import { initI18n } from "@/lib/i18n/instance";
import { getStoredLanguage } from "@/lib/i18n/storage";
import { syncLayoutDirectionForLanguage } from "@/lib/i18n/rtl";
import type { AppLanguage } from "@/lib/i18n/constants";
// Import background location task immediately to ensure it registers at module load time
// This is required by Expo TaskManager
import "@/services/backgroundLocationTask";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

// Prevent the splash screen from auto-hiding before asset loading is complete.
// SplashScreen.preventAutoHideAsync();

// Global error handler to catch UserHandle serialization errors
// This error occurs on subsequent app launches when expo-device tries to access system properties
// or when expo-notifications tries to serialize notification responses containing UserHandle
// Using a try-catch to safely handle ErrorUtils availability
try {
  // ErrorUtils might not be available in all React Native versions or build configurations
  const ErrorUtils = require("react-native").ErrorUtils;
  if (
    ErrorUtils &&
    typeof ErrorUtils.getGlobalHandler === "function" &&
    typeof ErrorUtils.setGlobalHandler === "function"
  ) {
    const originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      const errorMessage = error?.message || String(error);
      const errorStack = error?.stack || "";

      // Check if this is the UserHandle serialization error
      // This can occur from expo-device or expo-notifications when trying to serialize Android Intent extras
      if (
        errorMessage.includes("UserHandle") ||
        errorMessage.includes("NativeUnimoduleProxy") ||
        errorMessage.includes("Could not put") ||
        errorMessage.includes("WritableMap") ||
        errorStack.includes("NotificationsEmitter") ||
        errorStack.includes("NotificationManager") ||
        errorStack.includes("onNotificationResponseIntentReceived") ||
        errorMessage.includes("expo.modules.notifications")
      ) {
        logger.warn(
          "Caught UserHandle serialization error - this is a known issue with expo-notifications on Android"
        );
        logger.warn(
          "The error occurs when reopening the app from a notification. The app will continue to function normally."
        );
        // Don't crash the app - just log the error
        // The notification data will be handled by the safe wrappers in notification listeners
        return;
      }

      // Call the original error handler for other errors
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    });
  }
} catch (error) {
  // Silently fail if ErrorUtils is not available - the safe wrapper in notification listeners will still work
  logger.warn("Could not set up global error handler", error);
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    "TT-Octosquares-Medium": require("../assets/fonts/TT-Octosquares-Medium.ttf"),
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    LogBox.ignoreAllLogs(true);
  }, []);

  useEffect(() => {
    if (!loaded && !error) {
      return;
    }
    let cancelled = false;
    (async () => {
      const stored = await getStoredLanguage();
      const lng: AppLanguage = stored === "ar" ? "ar" : "en";
      await initI18n(lng);
      syncLayoutDirectionForLanguage(lng);
      if (!cancelled) {
        setI18nReady(true);
        await SplashScreen.hideAsync();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  if (!i18nReady) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <I18nActionsProvider>
      <DriverProvider>
        <TripActivationProvider>
          <ToastProvider>
            <OfflineIndicator />
            {/* Omit explicit Stack.Screen list so all file-based routes (e.g. (routes)/*) are registered */}
            <Stack screenOptions={{ headerShown: false }} />
          </ToastProvider>
        </TripActivationProvider>
      </DriverProvider>
    </I18nActionsProvider>
  );
}
