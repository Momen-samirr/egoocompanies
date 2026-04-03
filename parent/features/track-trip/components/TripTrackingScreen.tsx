/**
 * Main trip tracking screen component
 * Orchestrates all hooks and components for real-time trip tracking
 */

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Trip, Coordinate, RouteSegment } from "../types";
import { useTripTracking } from "../hooks/useTripTracking";
import { useTripData } from "../hooks/useTripData";
import { useDriverLocation } from "../hooks/useDriverLocation";
import { useMapRegion } from "../hooks/useMapRegion";
import { useETA } from "../hooks/useETA";
import { MapViewContainer } from "./map/MapViewContainer";
import { RoutePolyline } from "./map/RoutePolyline";
import { RouteMarker } from "./map/RouteMarker";
import { DriverMarker } from "./map/DriverMarker";
import { ConnectionStatus } from "./ui/ConnectionStatus";
import { ETACard } from "./ui/ETACard";
import { DriverInfo } from "./ui/DriverInfo";
import { TripInfoCard } from "./ui/TripInfoCard";
import MapControlStack from "@/components/kinetic/MapControlStack";

/**
 * Props for TripTrackingScreen component
 */
export interface TripTrackingScreenProps {
  tripId?: string | string[];
  studentId?: string | string[];
}

/**
 * Main trip tracking screen
 */
export function TripTrackingScreen({
  tripId: propTripId,
  studentId: propStudentId,
}: TripTrackingScreenProps = {}) {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Get tripId and studentId from props or params
  const tripId = propTripId || params.tripId;
  const studentId = propStudentId || params.studentId;

  // Normalize IDs (Expo Router params can be arrays)
  const normalizedTripId = Array.isArray(tripId) ? tripId[0] : tripId;
  const normalizedStudentId = Array.isArray(studentId)
    ? studentId[0]
    : studentId;

  // WebSocket location tracking
  const { location, connected, error } = useTripTracking({
    tripId: normalizedTripId,
    studentId: normalizedStudentId,
    enabled: !!(normalizedTripId && normalizedStudentId),
  });

  // Trip data fetching
  const { trip, loading } = useTripData({
    studentId: normalizedStudentId,
    enabled: !!(normalizedStudentId),
  });

  // Driver location management
  // Extract location from TripLocationUpdate if available
  const driverLocationFromUpdate = location?.location || null;
  const { driverLocation, driverCoordinate, hasLocation } = useDriverLocation({
    location: driverLocationFromUpdate,
  });

  // Map region management
  const { region } = useMapRegion({
    trip,
    driverLocation: driverCoordinate,
  });

  // ETA calculation
  const { eta, calculating: calculatingETA } = useETA({
    trip,
    driverLocation: driverCoordinate,
  });

  // Marker update key for forcing remounts - increment on every location update
  const [driverMarkerKeyCounter, setDriverMarkerKeyCounter] = useState(0);
  
  useEffect(() => {
    if (driverLocation) {
      // Increment counter on every location update to force marker re-render
      setDriverMarkerKeyCounter((prev) => prev + 1);
    }
  }, [driverLocation?.latitude, driverLocation?.longitude, location?.timestamp]);

  // Memoize route segments for visualization
  const routeSegments = useMemo((): RouteSegment[] => {
    if (!trip?.points || trip.points.length < 2) {
      return [];
    }

    const currentIdx = trip.progress?.currentPointIndex ?? 0;
    const segments: RouteSegment[] = [];

    for (let i = 0; i < trip.points.length - 1; i++) {
      const start = trip.points[i];
      const end = trip.points[i + 1];

      if (start.latitude && start.longitude && end.latitude && end.longitude) {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;

        segments.push({
          index: i,
          start: { latitude: start.latitude, longitude: start.longitude },
          end: { latitude: end.latitude, longitude: end.longitude },
          isCompleted,
          isCurrent,
        });
      }
    }

    return segments;
  }, [trip?.points, trip?.progress?.currentPointIndex, trip?.id]);

  // Memoize student point
  const studentPoint = useMemo(() => {
    return trip?.studentPoint || trip?.points?.[0] || null;
  }, [trip?.studentPoint?.id, trip?.points?.[0]?.id]);

  const studentPointId = useMemo(() => {
    return studentPoint?.id || null;
  }, [studentPoint?.id]);

  // Calculate student point index
  const studentPointIndex = useMemo(() => {
    if (!studentPoint || !studentPointId || !trip?.points) {
      return -1;
    }
    return trip.points.findIndex((p) => p.id === studentPointId);
  }, [studentPointId, trip?.points]);

  // Current point index
  const currentPointIndex = trip?.progress?.currentPointIndex ?? 0;
  const totalPoints = trip?.points?.length || 0;

  // Determine display ETA (calculated or from WebSocket)
  const displayETA = eta || (location?.eta ? {
    minutes: location.eta.minutes,
    distanceMeters: location.eta.distanceMeters || 0,
  } : null);

  // Handle call driver
  const handleCallDriver = useCallback(() => {
    if (trip?.assignedCaptain?.phone_number) {
      Linking.openURL(`tel:${trip.assignedCaptain.phone_number}`);
    }
  }, [trip?.assignedCaptain?.phone_number]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#494BD6" />
      </View>
    );
  }

  // No trip state
  if (!trip) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Trip not found</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      {region && (
        <MapViewContainer region={region}>
          {/* Route visualization */}
          {routeSegments.length > 0 && (
            <RoutePolyline
              key={`route-${trip.id}-${currentPointIndex}`}
              segments={routeSegments}
            />
          )}

          {/* Trip point markers */}
          {trip.points.map((point, index) => {
            if (!point.latitude || !point.longitude || !point.id) {
              return null;
            }

            const isStudentPoint = point.id === studentPointId;
            const isStartPoint = index === 0;
            const isCompleted = index < currentPointIndex;
            const isCurrent = index === currentPointIndex;

            return (
              <RouteMarker
                key={`point-${point.id}`}
                point={point}
                index={index}
                isCompleted={isCompleted}
                isCurrent={isCurrent}
                isStudentPoint={isStudentPoint}
                isStartPoint={isStartPoint}
              />
            );
          })}

          {/* Driver marker */}
          {driverLocation && driverCoordinate && (
            <DriverMarker
              key={`driver-marker-${driverMarkerKeyCounter}`}
              coordinate={driverCoordinate}
              heading={driverLocation.heading}
              driverName={trip.assignedCaptain?.name}
              updateKey={driverMarkerKeyCounter}
            />
          )}
        </MapViewContainer>
      )}

      <View style={styles.livePill}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Live</Text>
        <View style={styles.liveDivider} />
        <Text style={styles.liveMeta}>Last update: just now</Text>
      </View>

      <MapControlStack />

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Connection Status */}
          <ConnectionStatus
            connected={connected}
            error={error}
            showDirectionsError={false} // TODO: Track directions error state if needed
          />

          {/* ETA Card */}
          {displayETA && (
            <ETACard eta={displayETA} calculating={calculatingETA} />
          )}

          {/* Driver Info Card */}
          {trip.assignedCaptain && (
            <DriverInfo
              driver={trip.assignedCaptain}
              onCall={handleCallDriver}
            />
          )}

          {/* Trip Info Card */}
          <TripInfoCard
            trip={trip}
            studentPoint={studentPoint}
            currentPointIndex={currentPointIndex}
            totalPoints={totalPoints}
            showMissingLocationWarning={connected && !hasLocation}
          />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    maxHeight: "54%",
    shadowColor: "#4648d4",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 5,
    paddingTop: 10,
  },
  livePill: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    zIndex: 20,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: "#10b981",
    marginRight: 6,
  },
  liveText: {
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 11,
    fontWeight: "700",
    color: "#191C1D",
  },
  liveDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(199,196,215,0.6)",
    marginHorizontal: 8,
  },
  liveMeta: {
    color: "#60636E",
    fontSize: 11,
  },
  errorText: {
    fontSize: 18,
    color: "#ef4444",
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#494BD6",
    padding: 15,
    borderRadius: 16,
    minWidth: 120,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default TripTrackingScreen;

