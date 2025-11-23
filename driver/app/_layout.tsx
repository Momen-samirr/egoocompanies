import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import { Stack } from "expo-router";
import { ToastProvider } from "react-native-toast-notifications";
import { LogBox } from "react-native";
import { useFonts } from "expo-font";
import React from "react";
import { DriverProvider } from "@/contexts/DriverContext";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

// Prevent the splash screen from auto-hiding before asset loading is complete.
// SplashScreen.preventAutoHideAsync();

// Global error handler to catch UserHandle serialization errors
// This error occurs on subsequent app launches when expo-device tries to access system properties
// Using a try-catch to safely handle ErrorUtils availability
try {
  // ErrorUtils might not be available in all React Native versions or build configurations
  const ErrorUtils = require("react-native").ErrorUtils;
  if (ErrorUtils && typeof ErrorUtils.getGlobalHandler === "function" && typeof ErrorUtils.setGlobalHandler === "function") {
    const originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      const errorMessage = error?.message || String(error);
      
      // Check if this is the UserHandle serialization error
      if (
        errorMessage.includes("UserHandle") ||
        errorMessage.includes("NativeUnimoduleProxy") ||
        errorMessage.includes("Could not put") ||
        errorMessage.includes("WritableMap")
      ) {
        console.warn("⚠️ Caught UserHandle serialization error - this is a known issue with expo-device on Android");
        console.warn("⚠️ The app will continue to function, but some device features may be unavailable");
        // Don't crash the app - just log the error
        return;
      }
      
      // Call the original error handler for other errors
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    });
  }
} catch (error) {
  // Silently fail if ErrorUtils is not available - the safe wrapper in home.screen.tsx will still work
  console.warn("⚠️ Could not set up global error handler:", error);
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    "TT-Octosquares-Medium": require("../assets/fonts/TT-Octosquares-Medium.ttf"),
  });

  useEffect(() => {
    LogBox.ignoreAllLogs(true);
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <DriverProvider>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
        </Stack>
      </ToastProvider>
    </DriverProvider>
  );
}
