import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from "react-native";
import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import color from "@/themes/app.colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Toast } from "react-native-toast-notifications";
import { getServerUri } from "@/configs/constants";
import { useTheme } from "@react-navigation/native";
import Header from "@/components/common/header";
import { Gps, Location } from "@/utils/icons";

interface ScheduledTrip {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED" | "FORCE_CLOSED";
  companyId?: string;
  price?: number;
  company?: {
    id: string;
    name: string;
  };
  assignedCaptain: {
    id: string;
    name: string;
    phone_number: string;
    email: string;
  };
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
    lastLocationUpdate: string | null;
  } | null;
}

export default function ScheduledTripDetailsScreen() {
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams() as { tripId: string };
  const [trip, setTrip] = useState<ScheduledTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [region, setRegion] = useState<any>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    fetchTrip();
    checkOnlineStatus();
  }, [tripId]);

  const checkOnlineStatus = async () => {
    try {
      const status = await AsyncStorage.getItem("status");
      setIsOnline(status === "active");
    } catch (error) {
      console.error("Error checking online status:", error);
    }
  };

  const fetchTrip = async () => {
    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        Toast.show("Please login first", { type: "danger" });
        return;
      }

      const response = await axios.get(
        `${getServerUri()}/driver/scheduled-trips`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        const foundTrip = response.data.trips.find(
          (t: ScheduledTrip) => t.id === tripId
        );
        if (foundTrip) {
          setTrip(foundTrip);
          updateMapRegion(foundTrip);
        } else {
          Toast.show("Trip not found", { type: "danger" });
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

  const updateMapRegion = (tripData: ScheduledTrip) => {
    if (tripData.points && tripData.points.length > 0) {
      const latitudes = tripData.points.map((p) => p.latitude);
      const longitudes = tripData.points.map((p) => p.longitude);

      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);

      const latDelta = (maxLat - minLat) * 1.5 || 0.0922;
      const lngDelta = (maxLng - minLng) * 1.5 || 0.0421;

      setRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(latDelta, 0.0922),
        longitudeDelta: Math.max(lngDelta, 0.0421),
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return "#fbbf24";
      case "ACTIVE":
        return "#3b82f6";
      case "COMPLETED":
        return "#10b981";
      case "CANCELLED":
        return "#ef4444";
      case "FAILED":
        return "#dc2626"; // dark red for failed trips
      case "FORCE_CLOSED":
        return "#e11d48"; // rose-600 for force closed
      default:
        return "#6b7280";
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header isOn={isOnline} toggleSwitch={() => {}} />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color={color.primary} />
        </View>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header isOn={isOnline} toggleSwitch={() => {}} />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16 }}>
            Trip not found
          </Text>
        </View>
      </View>
    );
  }

  const statusColor = getStatusColor(trip.status);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header isOn={isOnline} toggleSwitch={() => {}} />
      <ScrollView>
        {/* Map */}
        <View style={{ height: windowHeight(300) }}>
          <MapView style={{ flex: 1 }} region={region}>
            {trip.points.map((point, index) => (
              <Marker
                key={point.id}
                coordinate={{
                  latitude: point.latitude,
                  longitude: point.longitude,
                }}
                title={point.name}
                description={`Checkpoint ${index + 1}${point.isFinalPoint ? " (Final)" : ""}`}
                pinColor={point.isFinalPoint ? "green" : "blue"}
              />
            ))}
            {trip.points.length > 1 &&
              trip.points.map((point, index) => {
                if (index === trip.points.length - 1) return null;
                const nextPoint = trip.points[index + 1];
                return (
                  <MapViewDirections
                    key={`route-${index}`}
                    origin={{
                      latitude: point.latitude,
                      longitude: point.longitude,
                    }}
                    destination={{
                      latitude: nextPoint.latitude,
                      longitude: nextPoint.longitude,
                    }}
                    apikey={process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY!}
                    strokeWidth={3}
                    strokeColor={index === trip.points.length - 2 ? "green" : "blue"}
                  />
                );
              })}
          </MapView>
        </View>

        {/* Trip Details */}
        <View style={{ padding: windowWidth(5) }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: windowWidth(5),
              marginBottom: windowHeight(2),
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: windowHeight(2),
              }}
            >
              <Text
                style={{
                  fontSize: fontSizes.FONT24,
                  fontWeight: "bold",
                  color: colors.text,
                }}
              >
                {trip.name}
              </Text>
              <View
                style={{
                  backgroundColor: statusColor + "20",
                  paddingHorizontal: windowWidth(3),
                  paddingVertical: windowHeight(1),
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    color: statusColor,
                    fontSize: fontSizes.FONT14,
                    fontWeight: "600",
                  }}
                >
                  {trip.status === "FAILED" ? "Failed" : trip.status === "FORCE_CLOSED" ? "Force Closed" : trip.status}
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: windowWidth(2),
                marginBottom: windowHeight(1),
              }}
            >
              {trip.company?.name && (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: color.primary,
                    paddingHorizontal: windowWidth(3),
                    paddingVertical: windowHeight(1),
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      color: color.primary,
                      fontSize: fontSizes.FONT12,
                      fontFamily: fonts.medium,
                    }}
                  >
                    {trip.company.name}
                  </Text>
                </View>
              )}
              {typeof trip.price === "number" && (
                <Text
                  style={{
                    color: color.secondaryFont,
                    fontSize: fontSizes.FONT14,
                    fontFamily: fonts.medium,
                  }}
                >
                  ${trip.price.toFixed(2)}
                </Text>
              )}
            </View>

            <View style={{ marginBottom: windowHeight(2) }}>
              <Text
                style={{
                  fontSize: fontSizes.FONT18,
                  color: color.secondaryFont,
                  marginBottom: windowHeight(1),
                }}
              >
                📅 Scheduled: {formatDateTime(trip.scheduledTime)}
              </Text>
              <Text
                style={{
                  fontSize: fontSizes.FONT18,
                  color: color.secondaryFont,
                }}
              >
                📍 Total Checkpoints: {trip.points.length}
              </Text>
            </View>

            {trip.progress?.startedAt && (
              <Text
                style={{
                  fontSize: fontSizes.FONT16,
                  color: colors.text,
                  marginBottom: windowHeight(1),
                }}
              >
                ✅ Started: {formatDateTime(trip.progress.startedAt)}
              </Text>
            )}
            {trip.progress?.completedAt && (
              <Text
                style={{
                  fontSize: fontSizes.FONT16,
                  color: colors.text,
                }}
              >
                🎉 Completed: {formatDateTime(trip.progress.completedAt)}
              </Text>
            )}
          </View>

          {/* Checkpoints List */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: windowWidth(5),
              marginBottom: windowHeight(2),
            }}
          >
            <Text
              style={{
                fontSize: fontSizes.FONT20,
                fontWeight: "600",
                color: colors.text,
                marginBottom: windowHeight(2),
              }}
            >
              Checkpoints
            </Text>
            {trip.points.map((point, index) => (
              <View
                key={point.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: windowHeight(2),
                  paddingBottom: windowHeight(2),
                  borderBottomWidth:
                    index < trip.points.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: windowWidth(10),
                    height: windowWidth(10),
                    borderRadius: windowWidth(5),
                    backgroundColor: point.isFinalPoint
                      ? "#10b981"
                      : point.reachedAt
                      ? "#3b82f6"
                      : "#9ca3af",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: windowWidth(3),
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: fontSizes.FONT14,
                    }}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSizes.FONT18,
                      fontWeight: "500",
                      color: colors.text,
                    }}
                  >
                    {point.name}
                    {point.isFinalPoint && (
                      <Text style={{ color: "#10b981" }}> (Final)</Text>
                    )}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSizes.FONT14,
                      color: color.secondaryFont,
                      marginTop: windowHeight(0.5),
                    }}
                  >
                    {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                  </Text>
                  {point.reachedAt && (
                    <Text
                      style={{
                        fontSize: fontSizes.FONT14,
                        color: "#10b981",
                        marginTop: windowHeight(0.5),
                      }}
                    >
                      ✓ Reached: {formatDateTime(point.reachedAt)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          {trip.status === "SCHEDULED" && (
            <TouchableOpacity
              onPress={() => {
                router.push({
                  pathname: "/scheduled-trips",
                });
              }}
              style={{
                backgroundColor: color.primary,
                padding: windowHeight(2),
                borderRadius: 8,
                alignItems: "center",
                marginBottom: windowHeight(2),
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: fontSizes.FONT18,
                  fontWeight: "600",
                }}
              >
                Go to Scheduled Trips
              </Text>
            </TouchableOpacity>
          )}

          {trip.status === "ACTIVE" && (
            <TouchableOpacity
              onPress={() => {
                router.push({
                  pathname: "/trip-navigation",
                  params: { tripId: trip.id },
                });
              }}
              style={{
                backgroundColor: color.primary,
                padding: windowHeight(2),
                borderRadius: 8,
                alignItems: "center",
                marginBottom: windowHeight(2),
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: fontSizes.FONT18,
                  fontWeight: "600",
                }}
              >
                Continue Trip
              </Text>
            </TouchableOpacity>
          )}

          {trip.status === "FORCE_CLOSED" && (
            <View
              style={{
                backgroundColor: "#fce7f3", // rose-100
                padding: windowHeight(2),
                borderRadius: 8,
                alignItems: "center",
                marginBottom: windowHeight(2),
                borderWidth: 1,
                borderColor: color.status.forceClosed,
              }}
            >
              <Text
                style={{
                  color: color.status.forceClosed,
                  fontSize: fontSizes.FONT18,
                  fontWeight: "600",
                  marginBottom: windowHeight(1),
                }}
              >
                ⚠️ Trip Force Closed
              </Text>
              <Text
                style={{
                  color: color.status.forceClosed,
                  fontSize: fontSizes.FONT14,
                  textAlign: "center",
                }}
              >
                This trip was closed by admin. A financial deduction has been applied to your account.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

