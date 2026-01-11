/**
 * Track Trip Route Screen
 * This file is now a thin wrapper that imports the feature module
 */

import React from "react";
import { useLocalSearchParams } from "expo-router";
import TripTrackingScreen from "@/features/track-trip";

export default function TrackTripScreen() {
  const params = useLocalSearchParams();

  // Ensure tripId and studentId are strings (Expo Router params can be arrays)
  const tripId = Array.isArray(params.tripId)
    ? params.tripId[0]
    : params.tripId;
  const studentId = Array.isArray(params.studentId)
    ? params.studentId[0]
    : params.studentId;

  return <TripTrackingScreen tripId={tripId} studentId={studentId} />;
}
