import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useTheme } from "@react-navigation/native";
import Header from "@/components/common/header";
import { Toast } from "react-native-toast-notifications";
import { useGetDriverData } from "@/hooks/useGetDriverData";
import { getServerUri } from "@/configs/constants";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Location from "expo-location";
import color from "@/themes/app.colors";
import { BackArrow } from "@/assets/icons/backArrow";
import { windowHeight, windowWidth } from "@/themes/app.constant";

interface ScheduledTrip {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED";
  points: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    isFinalPoint: boolean;
    reachedAt: string | null;
  }>;
  activationStatus: {
    canActivate: boolean;
    reason?: string;
    distanceToFirstPoint?: number;
    isWithinTimeWindow?: boolean;
    isTooEarly?: boolean;
    earliestStartTime?: string;
  } | null;
}

export default function ScheduledTripsScreen() {
  const { colors } = useTheme();
  const { driver } = useGetDriverData();
  const [trips, setTrips] = useState<ScheduledTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingTrip, setStartingTrip] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);

  useEffect(() => {
    fetchTrips();
    checkOnlineStatus();
  }, []);

  // Update online status when driver data changes
  useEffect(() => {
    if (driver?.status) {
      setIsOnline(driver.status === "active");
    }
  }, [driver?.status]);

  const checkOnlineStatus = async () => {
    try {
      const status = await AsyncStorage.getItem("status");
      setIsOnline(status === "active");
    } catch (error) {
      console.error("Error checking online status:", error);
    }
  };

  const handleStatusChange = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        Toast.show("Please login first", { type: "danger" });
        return;
      }

      const newStatus = !isOnline ? "active" : "inactive";
      
      const response = await axios.put(
        `${getServerUri()}/driver/update-status`,
        {
          status: newStatus,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data) {
        const newIsOn = !isOnline;
        setIsOnline(newIsOn);
        await AsyncStorage.setItem("status", response.data.driver.status);
        
        // Refresh trips to update activation status
        fetchTrips();
        
        Toast.show(
          `You are now ${newStatus === "active" ? "online" : "offline"}`,
          { type: "success" }
        );
      }
    } catch (error: any) {
      console.error("Error updating status:", error);
      Toast.show(
        error.response?.data?.message || "Failed to update status",
        { type: "danger" }
      );
    }
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        Toast.show("Please login first", { type: "danger" });
        return;
      }

      // Get current location to send with request
      const queryParams: string[] = [];
      
      try {
        const { status: locationPermission } = await Location.requestForegroundPermissionsAsync();
        if (locationPermission === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          queryParams.push(`latitude=${location.coords.latitude}`);
          queryParams.push(`longitude=${location.coords.longitude}`);
        }
      } catch (error) {
        console.log("Could not get current location:", error);
        // Continue without location - backend will use stored location if available
      }

      const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
      const url = `${getServerUri()}/driver/scheduled-trips${queryString}`;
      
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.data.success) {
        setTrips(response.data.trips);
        // Update online status from driver data
        if (driver?.status) {
          setIsOnline(driver.status === "active");
        }
      }
    } catch (error: any) {
      console.error("Error fetching scheduled trips:", error);
      Toast.show(error.response?.data?.message || "Failed to fetch trips", {
        type: "danger",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    checkOnlineStatus();
    fetchTrips();
  };

  const handleStartTrip = async (trip: ScheduledTrip) => {
    try {
      setStartingTrip(trip.id);

      // Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Toast.show("Location permission is required", { type: "danger" });
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        Toast.show("Please login first", { type: "danger" });
        return;
      }

      const response = await axios.post(
        `${getServerUri()}/driver/start-trip/${trip.id}`,
        {
          latitude,
          longitude,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        Toast.show("Trip started successfully!", { type: "success" });
        // Navigate to trip navigation screen
        router.push({
          pathname: "/trip-navigation",
          params: { tripId: trip.id },
        });
      }
    } catch (error: any) {
      console.error("Error starting trip:", error);
      Toast.show(
        error.response?.data?.message || "Failed to start trip",
        { type: "danger" }
      );
    } finally {
      setStartingTrip(null);
      fetchTrips();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return "#fbbf24"; // yellow
      case "ACTIVE":
        return "#3b82f6"; // blue
      case "COMPLETED":
        return "#10b981"; // green
      case "CANCELLED":
        return "#ef4444"; // red
      case "FAILED":
        return "#dc2626"; // dark red for failed trips
      default:
        return "#6b7280"; // gray
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const renderTripItem = ({ item }: { item: ScheduledTrip }) => {
    const dateTime = formatDateTime(item.scheduledTime);
    const statusColor = getStatusColor(item.status);
    // Trip can only be started if: captain is online AND activation conditions are met
    const canStart = isOnline && item.activationStatus?.canActivate && item.status === "SCHEDULED";

    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.text }}>
            {item.name}
          </Text>
          <View
            style={{
              backgroundColor: statusColor + "20",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: statusColor, fontSize: 12, fontWeight: "600" }}>
              {item.status === "FAILED" ? "Failed" : item.status}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 14 }}>
            📅 {dateTime.date} at {dateTime.time}
          </Text>
          <Text style={{ color: colors.text, fontSize: 14, marginTop: 4 }}>
            📍 {item.points?.length || 0} checkpoint(s)
          </Text>
        </View>

        {item.activationStatus && item.status === "SCHEDULED" && !item.isTooEarly && (
          <View
            style={{
              backgroundColor: canStart ? "#10b98120" : "#fbbf2420",
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {!isOnline && (
              <Text
                style={{
                  color: "#ef4444",
                  fontSize: 12,
                  fontWeight: "600",
                  marginBottom: 4,
                }}
              >
                ⚠️ You must be online to start trips
              </Text>
            )}
            {isOnline && item.activationStatus.distanceToFirstPoint !== undefined && (
              <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>
                Distance to first checkpoint:{" "}
                {(item.activationStatus.distanceToFirstPoint / 1000).toFixed(2)} km
              </Text>
            )}
            {isOnline && (
              <Text style={{ color: colors.text, fontSize: 11, marginBottom: 4, opacity: 0.7 }}>
                Scheduled: {formatDateTime(item.scheduledTime).date} at {formatDateTime(item.scheduledTime).time}
                {item.activationStatus?.earliestStartTime && (
                  <Text>
                    {"\n"}Earliest start: {new Date(item.activationStatus.earliestStartTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                )}
              </Text>
            )}
            <Text
              style={{
                color: canStart ? "#10b981" : "#fbbf24",
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {canStart
                ? "✓ Ready to start!"
                : !isOnline
                ? "Go online to start this trip"
                : item.activationStatus.reason || "Conditions not met"}
            </Text>
          </View>
        )}

        {item.status === "FAILED" ? (
          <View
            style={{
              backgroundColor: "#dc2626",
              padding: 12,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>
              ❌ Trip Failed (Overdue)
            </Text>
          </View>
        ) : item.status === "SCHEDULED" ? (
          <TouchableOpacity
            onPress={() => handleStartTrip(item)}
            disabled={!canStart || startingTrip === item.id}
            style={{
              backgroundColor: canStart ? color.primary : "#9ca3af",
              padding: 12,
              borderRadius: 8,
              alignItems: "center",
              opacity: startingTrip === item.id ? 0.6 : 1,
            }}
          >
            {startingTrip === item.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600" }}>Start Trip</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {item.status === "ACTIVE" && (
          <TouchableOpacity
            onPress={() => {
              router.push({
                pathname: "/trip-navigation",
                params: { tripId: item.id },
              });
            }}
            style={{
              backgroundColor: color.primary,
              padding: 12,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Continue Trip</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleBackToHome = () => {
    router.push("/(tabs)/home");
  };

  if (loading && trips.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header isOn={isOnline} toggleSwitch={handleStatusChange} />
        <TouchableOpacity
          onPress={handleBackToHome}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
          activeOpacity={0.7}
        >
          <BackArrow colors={color.primary} width={20} height={20} />
          <Text
            style={{
              marginLeft: 8,
              fontSize: 16,
              fontWeight: "600",
              color: color.primary,
            }}
          >
            Back to Home
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={color.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header isOn={isOnline} toggleSwitch={handleStatusChange} />
      <TouchableOpacity
        onPress={handleBackToHome}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
        activeOpacity={0.7}
      >
        <BackArrow colors={color.primary} width={20} height={20} />
        <Text
          style={{
            marginLeft: 8,
            fontSize: 16,
            fontWeight: "600",
            color: color.primary,
          }}
        >
          Back to Home
        </Text>
      </TouchableOpacity>
      {!isOnline && (
        <View
          style={{
            backgroundColor: "#fbbf2420",
            padding: 12,
            margin: 16,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#fbbf24",
          }}
        >
          <Text style={{ color: "#fbbf24", fontSize: 14, fontWeight: "600" }}>
            ⚠️ You are offline. Go online to receive and start scheduled trips.
          </Text>
        </View>
      )}
      <FlatList
        data={trips}
        renderItem={renderTripItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 50 }}>
            <Text style={{ color: colors.text, fontSize: 16 }}>
              No scheduled trips found
            </Text>
          </View>
        }
      />
    </View>
  );
}

