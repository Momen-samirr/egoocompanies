import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import React, { useEffect, useState, useRef } from "react";
import { useTheme } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { windowHeight, windowWidth, fontSizes } from "@/themes/app.constant";
import { Toast } from "react-native-toast-notifications";
import { useGetDriverData } from "@/hooks/useGetDriverData";
import { getServerUri } from "@/configs/constants";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import color from "@/themes/app.colors";
import { calculateDistance } from "@/utils/haversine";
import CheckpointCard from "@/components/trip/CheckpointCard";
import ETADisplay from "@/components/common/ETADisplay";
import EmergencyEndSlider from "@/components/trip/EmergencyEndSlider";
import { spacing, shadows } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";

interface ScheduledTrip {
  id: string;
  name: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  points: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    isFinalPoint: boolean;
    reachedAt: string | null;
  }>;
  progress: {
    currentPointIndex: number;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
}

export default function TripNavigationScreen() {
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { driver } = useGetDriverData();
  const [trip, setTrip] = useState<ScheduledTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [distanceToCheckpoint, setDistanceToCheckpoint] = useState<number | undefined>(undefined);
  const [etaToCheckpoint, setEtaToCheckpoint] = useState<number | undefined>(undefined);
  const [canUseEmergency, setCanUseEmergency] = useState(true);
  const [emergencyDisabledMessage, setEmergencyDisabledMessage] = useState<string>("");
  const mapRef = useRef<MapView>(null);
  const locationWatchSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (tripId) {
      fetchTrip();
      startLocationTracking();
      checkEmergencyUsageStatus();
    }
  }, [tripId]);

  const checkEmergencyUsageStatus = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        return;
      }

      const response = await axios.get(
        `${getServerUri()}/driver/emergency-usage-status`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        setCanUseEmergency(response.data.canUse);
        if (!response.data.canUse && response.data.message) {
          setEmergencyDisabledMessage(response.data.message);
        }
      }
    } catch (error: any) {
      console.error("Error checking emergency usage status:", error);
      // Default to allowing if check fails (fail open for safety)
      setCanUseEmergency(true);
    }
  };

  const fetchTrip = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        Toast.show("Please login first", { type: "danger" });
        return;
      }

      const response = await axios.get(
        `${getServerUri()}/driver/scheduled-trips?status=ACTIVE`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        const activeTrip = response.data.trips.find((t: ScheduledTrip) => t.id === tripId);
        if (activeTrip) {
          setTrip(activeTrip);
          // Wait for location to be available before updating map
          setTimeout(() => {
            if (currentLocation) {
              updateMapRegion(activeTrip);
              updateDistanceAndETA(currentLocation);
            }
          }, 500);
        } else {
          Toast.show("Trip not found or not active", { type: "danger" });
          router.back();
        }
      }
    } catch (error: any) {
      console.error("Error fetching trip:", error);
      Toast.show(error.response?.data?.message || "Failed to fetch trip", {
        type: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Toast.show("Location permission is required", { type: "danger" });
      return;
    }

    // Get initial location
    const location = await Location.getCurrentPositionAsync({});
    setCurrentLocation(location);
    updateDistanceAndETA(location);

    // Watch location updates
    locationWatchSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 10, // Update every 10 meters
      },
      (location) => {
        setCurrentLocation(location);
        updateDistanceAndETA(location);
        updateMapRegion();
      }
    );
  };

  const updateDistanceAndETA = (location: Location.LocationObject) => {
    if (!trip || !location) return;

    const currentPointIndex = trip.progress?.currentPointIndex || 0;
    const currentPoint = trip.points[currentPointIndex];
    
    if (!currentPoint || currentPoint.reachedAt) return;

    const distance = calculateDistance(
      location.coords.latitude,
      location.coords.longitude,
      currentPoint.latitude,
      currentPoint.longitude
    );

    setDistanceToCheckpoint(distance / 1000); // Convert to km

    // Estimate ETA (assuming average speed of 30 km/h in city)
    const estimatedSpeed = 30; // km/h
    const etaMinutes = (distance / 1000 / estimatedSpeed) * 60;
    setEtaToCheckpoint(etaMinutes);
  };

  const updateMapRegion = (tripData?: ScheduledTrip) => {
    const tripDataToUse = tripData || trip;
    if (!tripDataToUse || !tripDataToUse.points || tripDataToUse.points.length === 0 || !currentLocation || !mapRef.current) {
      return;
    }
    
    const currentPoint = tripDataToUse.points[tripDataToUse.progress?.currentPointIndex || 0];
    if (!currentPoint) return;

    const latDelta = Math.abs(currentPoint.latitude - currentLocation.coords.latitude) * 2.5;
    const lngDelta = Math.abs(currentPoint.longitude - currentLocation.coords.longitude) * 2.5;

    mapRef.current.animateToRegion({
      latitude: (currentPoint.latitude + currentLocation.coords.latitude) / 2,
      longitude: (currentPoint.longitude + currentLocation.coords.longitude) / 2,
      latitudeDelta: Math.max(latDelta, 0.05),
      longitudeDelta: Math.max(lngDelta, 0.05),
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (locationWatchSubscription.current) {
        locationWatchSubscription.current.remove();
      }
    };
  }, []);

  const handleReachCheckpoint = async (checkpointIndex: number) => {
    if (!trip || !currentLocation) {
      return;
    }

    const checkpoint = trip.points[checkpointIndex];
    if (!checkpoint) {
      return;
    }

    Alert.alert(
      "Reach Checkpoint",
      `Have you reached "${checkpoint.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, I'm here",
          onPress: async () => {
            try {
              setUpdatingProgress(true);
              const accessToken = await AsyncStorage.getItem("accessToken");
              if (!accessToken) {
                Toast.show("Please login first", { type: "danger" });
                return;
              }

              const response = await axios.post(
                `${getServerUri()}/driver/trip/progress`,
                {
                  tripId: trip.id,
                  checkpointIndex,
                  latitude: currentLocation.coords.latitude,
                  longitude: currentLocation.coords.longitude,
                },
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );

              if (response.data.success) {
                Toast.show(
                  checkpoint.isFinalPoint
                    ? "Trip completed successfully!"
                    : "Checkpoint reached!",
                  { type: "success" }
                );

                if (checkpoint.isFinalPoint) {
                  // Trip completed, go back to scheduled trips
                  setTimeout(() => {
                    router.push("/(tabs)/home");
                  }, 2000);
                } else {
                  // Refresh trip data
                  fetchTrip();
                }
              }
            } catch (error: any) {
              console.error("Error updating progress:", error);
              Toast.show(
                error.response?.data?.message || "Failed to update progress",
                { type: "danger" }
              );
            } finally {
              setUpdatingProgress(false);
            }
          },
        },
      ]
    );
  };

  const handleEmergencyTerminate = async () => {
    if (!trip) {
      return;
    }

    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        Toast.show("Please login first", { type: "danger" });
        return;
      }

      const response = await axios.post(
        `${getServerUri()}/driver/emergency-terminate-trip`,
        {
          tripId: trip.id,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        Toast.show("Trip emergency terminated successfully", {
          type: "success",
        });
        // Update local state
        setCanUseEmergency(false);
        setEmergencyDisabledMessage(
          "You have already used the emergency end option today."
        );
        // Navigate back to home
        setTimeout(() => {
          router.push("/(tabs)/home");
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error emergency terminating trip:", error);
      Toast.show(
        error.response?.data?.message || "Failed to emergency terminate trip",
        { type: "danger" }
      );
      throw error; // Re-throw to let the slider handle the error state
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={color.primary} />
        <Text style={{ marginTop: 10, color: colors.text }}>Loading trip...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.text }}>Trip not found</Text>
      </View>
    );
  }

  const currentPointIndex = trip.progress?.currentPointIndex || 0;
  const currentPoint = trip.points[currentPointIndex];
  const isCompleted = trip.status === "COMPLETED";

  // Calculate if driver is within 500m of the current checkpoint
  const isWithinRange = (checkpointIndex: number): boolean => {
    if (!currentLocation || !trip) {
      return false;
    }

    const checkpoint = trip.points[checkpointIndex];
    if (!checkpoint) {
      return false;
    }

    const distance = calculateDistance(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      checkpoint.latitude,
      checkpoint.longitude
    );

    return distance <= 500; // 500 meters
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Map View */}
      <View style={{ height: windowHeight(400), position: "relative" }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: currentPoint?.latitude || 0,
            longitude: currentPoint?.longitude || 0,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
          followsUserLocation={false}
        >
          {/* Current Location - Using showsUserLocation instead */}

          {/* Checkpoints */}
          {trip.points.map((point, index) => {
            const isReached = point.reachedAt !== null;
            const isCurrent = index === currentPointIndex && !isReached;
            const isPast = index < currentPointIndex;

            return (
              <Marker
                key={point.id}
                coordinate={{
                  latitude: point.latitude,
                  longitude: point.longitude,
                }}
                title={point.name}
                description={isReached ? "Reached" : isCurrent ? "Current" : "Upcoming"}
                pinColor={
                  isReached ? "green" : isCurrent ? "red" : isPast ? "gray" : "orange"
                }
              />
            );
          })}

          {/* Route to current checkpoint */}
          {currentLocation && currentPoint && !currentPoint.reachedAt && (
            <MapViewDirections
              origin={{
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
              }}
              destination={{
                latitude: currentPoint.latitude,
                longitude: currentPoint.longitude,
              }}
              apikey={process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY!}
              strokeWidth={4}
              strokeColor={color.primary}
              onReady={(result) => {
                // Update distance and ETA when route is calculated
                if (result.distance && result.duration) {
                  setDistanceToCheckpoint(result.distance / 1000); // Convert to km
                  setEtaToCheckpoint(result.duration / 60); // Convert to minutes
                }
              }}
            />
          )}
        </MapView>
        {/* Center on me button */}
        {currentLocation && (
          <TouchableOpacity
            style={{
              position: "absolute",
              bottom: spacing.md,
              right: spacing.md,
              backgroundColor: "#fff",
              width: 44,
              height: 44,
              borderRadius: 22,
              justifyContent: "center",
              alignItems: "center",
              ...shadows.md,
            }}
            onPress={updateMapRegion}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 20 }}>📍</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trip Info and Checkpoints */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
      >
        {/* Trip Header with Progress */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ fontSize: fontSizes.FONT24, fontWeight: "bold", color: colors.text, marginBottom: spacing.xs }}>
            {trip.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: fontSizes.FONT14, fontFamily: fonts.regular }}>
              Progress: {currentPointIndex + 1} of {trip.points.length} checkpoints
            </Text>
            {/* Progress Bar */}
            <View style={{ flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, marginLeft: spacing.md }}>
              <View
                style={{
                  width: `${((currentPointIndex + 1) / trip.points.length) * 100}%`,
                  height: "100%",
                  backgroundColor: color.status.completed,
                  borderRadius: 3,
                }}
              />
            </View>
          </View>
        </View>

        {/* Current Checkpoint ETA */}
        {currentPoint && !currentPoint.reachedAt && (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: spacing.lg,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: color.status.active,
            }}
          >
            <Text style={{ fontSize: fontSizes.FONT14, fontFamily: fonts.medium, color: color.text.secondary, marginBottom: spacing.sm }}>
              Next Checkpoint
            </Text>
            <Text style={{ fontSize: fontSizes.FONT18, fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.md }}>
              {currentPoint.name}
            </Text>
            <ETADisplay distance={distanceToCheckpoint} duration={etaToCheckpoint} size="md" />
          </View>
        )}

        {/* Checkpoints List */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ fontSize: fontSizes.FONT18, fontWeight: "600", color: colors.text, marginBottom: spacing.md, fontFamily: fonts.bold }}>
            All Checkpoints
          </Text>
          {trip.points.map((point, index) => {
            const isReached = point.reachedAt !== null;
            const isCurrent = index === currentPointIndex && !isReached;
            const isPast = index < currentPointIndex;

            return (
              <CheckpointCard
                key={point.id}
                checkpoint={point}
                isCurrent={isCurrent}
                isReached={isReached}
                isPast={isPast}
                distance={isCurrent ? distanceToCheckpoint : undefined}
                duration={isCurrent ? etaToCheckpoint : undefined}
                onReachPress={() => handleReachCheckpoint(index)}
                disabled={updatingProgress || !isWithinRange(index)}
                showReachButton={isCurrent && !isCompleted}
              />
            );
          })}
        </View>

        {isCompleted && (
          <View
            style={{
              backgroundColor: "#10b98120",
              padding: 16,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#10b981", fontSize: 16, fontWeight: "600" }}>
              ✓ Trip Completed!
            </Text>
          </View>
        )}

        {/* Emergency End Trip Slider - Only show for ACTIVE trips */}
        {!isCompleted && trip.status === "ACTIVE" && (
          <EmergencyEndSlider
            onConfirm={handleEmergencyTerminate}
            disabled={!canUseEmergency}
            disabledMessage={emergencyDisabledMessage}
          />
        )}
      </ScrollView>
    </View>
  );
}

