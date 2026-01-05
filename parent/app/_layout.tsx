import React, { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";
import { Stack } from "expo-router";
import { ToastProvider } from "react-native-toast-notifications";
import { LogBox } from "react-native";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  useEffect(() => {
    LogBox.ignoreAllLogs(true);
    SplashScreen.hideAsync();
  }, []);

  return (
    <ToastProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(routes)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ToastProvider>
  );
}







