import React, { Suspense } from "react";
import { View, ActivityIndicator } from "react-native";
import LoadingOverlay from "@/components/common/LoadingOverlay";

// Lazy load heavy navigation screen
const TripNavigationScreen = React.lazy(() => import("@/screens/trip-navigation/trip-navigation.screen"));

export default function index() {
  return (
    <Suspense fallback={<LoadingOverlay visible={true} message="Loading navigation..." fullScreen />}>
      <TripNavigationScreen />
    </Suspense>
  );
}

