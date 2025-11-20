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
import { windowHeight, windowWidth } from "@/themes/app.constant";
import { Toast } from "react-native-toast-notifications";
import { useGetDriverData } from "@/hooks/useGetDriverData";
import { getServerUri } from "@/configs/constants";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import color from "@/themes/app.colors";
import { calculateDistance } from "@/utils/haversine";

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
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (tripId) {
      fetchTrip();
      startLocationTracking();
    }
  }, [tripId]);

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
          updateMapRegion(activeTrip);
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

    // Watch location updates
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 10, // Update every 10 meters
      },
      (location) => {
        setCurrentLocation(location);
      }
    );
  };

  const updateMapRegion = (tripData: ScheduledTrip) => {
    if (tripData.points && tripData.points.length > 0 && currentLocation) {
      const currentPoint = tripData.points[tripData.progress?.currentPointIndex || 0];
      const latDelta = Math.abs(currentPoint.latitude - currentLocation.coords.latitude) * 2.5;
      const lngDelta = Math.abs(currentPoint.longitude - currentLocation.coords.longitude) * 2.5;

      mapRef.current?.animateToRegion({
        latitude: (currentPoint.latitude + currentLocation.coords.latitude) / 2,
        longitude: (currentPoint.longitude + currentLocation.coords.longitude) / 2,
        latitudeDelta: Math.max(latDelta, 0.05),
        longitudeDelta: Math.max(lngDelta, 0.05),
      });
    }
  };

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
      <View style={{ height: windowHeight(400) }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: currentPoint?.latitude || 0,
            longitude: currentPoint?.longitude || 0,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Current Location */}
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
              }}
              title="Your Location"
              pinColor="blue"
            />
          )}

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
            />
          )}
        </MapView>
      </View>

      {/* Trip Info and Checkpoints */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
      >
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 4 }}>
            {trip.name}
          </Text>
          <Text style={{ color: colors.text, fontSize: 14 }}>
            Progress: {currentPointIndex + 1} of {trip.points.length} checkpoints
          </Text>
        </View>

        {/* Checkpoints List */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 12 }}>
            Checkpoints
          </Text>
          {trip.points.map((point, index) => {
            const isReached = point.reachedAt !== null;
            const isCurrent = index === currentPointIndex && !isReached;
            const isPast = index < currentPointIndex;

            return (
              <View
                key={point.id}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                  borderWidth: isCurrent ? 2 : 1,
                  borderColor: isCurrent
                    ? color.primary
                    : isReached
                    ? "#10b981"
                    : colors.border,
                  opacity: isPast && !isReached ? 0.5 : 1,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                        {index + 1}. {point.name}
                      </Text>
                      {point.isFinalPoint && (
                        <Text
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            backgroundColor: "#a855f7",
                            color: "#fff",
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                          }}
                        >
                          FINAL
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.text, opacity: 0.7 }}>
                      {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                    </Text>
                    {isReached && (
                      <Text style={{ fontSize: 12, color: "#10b981", marginTop: 4 }}>
                        ✓ Reached at {new Date(point.reachedAt!).toLocaleTimeString()}
                      </Text>
                    )}
                  </View>
                  {isCurrent && !isCompleted && (
                    <TouchableOpacity
                      onPress={() => handleReachCheckpoint(index)}
                      disabled={updatingProgress || !isWithinRange(index)}
                      style={{
                        backgroundColor: color.primary,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                        opacity: updatingProgress || !isWithinRange(index) ? 0.6 : 1,
                      }}
                    >
                      {updatingProgress ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={{ color: "#fff", fontWeight: "600" }}>Reached</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
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
      </ScrollView>
    </View>
  );
}

