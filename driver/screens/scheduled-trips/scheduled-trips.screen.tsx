import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
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
import { windowHeight, windowWidth, fontSizes } from "@/themes/app.constant";
import { spacing, shadows } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import StatusBadge from "@/components/common/StatusBadge";
import { Location as LocationIcon, Calender } from "@/utils/icons";
import EmptyState from "@/components/common/EmptyState";
import { SkeletonList } from "@/components/common/LoadingSkeleton";
import DateSelector from "@/components/trip/DateSelector";
import {
  getCurrentWeek,
  getWeekStart,
  formatDateForAPI,
  isSameDay,
} from "@/utils/weekGenerator";

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
  
  // Date selector state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekDates, setWeekDates] = useState<Date[]>(getCurrentWeek());
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart());

  // Initial mount: check online status
  useEffect(() => {
    checkOnlineStatus();
  }, []);

  // Update online status when driver data changes
  useEffect(() => {
    if (driver?.status) {
      setIsOnline(driver.status === "active");
    }
  }, [driver?.status]);

  // Check for week changes and auto-update week dates
  useEffect(() => {
    const checkWeekChange = () => {
      const today = new Date();
      const currentWeekStart = getWeekStart(today);
      
      // Compare week start dates to detect week change
      if (
        currentWeekStart.getTime() !== weekStart.getTime()
      ) {
        // Week changed - regenerate dates and reset selected date to today
        const newWeekDates = getCurrentWeek();
        setWeekDates(newWeekDates);
        setSelectedDate(today);
        setWeekStart(currentWeekStart);
        console.log("📅 Week changed - updated date selector");
      }
    };

    // Check on mount
    checkWeekChange();

    // Check when app comes to foreground
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          checkWeekChange();
        }
      }
    );

    // Also check periodically (every 5 minutes) to catch week changes
    const intervalId = setInterval(checkWeekChange, 5 * 60 * 1000);

    return () => {
      subscription?.remove();
      clearInterval(intervalId);
    };
  }, [weekStart]);

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

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        Toast.show("Please login first", { type: "danger" });
        return;
      }

      // Get current location to send with request
      const queryParams: string[] = [];
      
      // Add date parameter for filtering
      const dateParam = formatDateForAPI(selectedDate);
      queryParams.push(`date=${dateParam}`);
      
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
        // Client-side backup filtering (in case API filtering doesn't work as expected)
        let filteredTrips = response.data.trips || [];
        
        // Additional client-side filtering by date as backup
        filteredTrips = filteredTrips.filter((trip: ScheduledTrip) => {
          if (!trip.tripDate) return false;
          const tripDate = new Date(trip.tripDate);
          return isSameDay(tripDate, selectedDate);
        });

        setTrips(filteredTrips);
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
  }, [selectedDate, driver?.status]);

  // Fetch trips on mount and when selected date changes
  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

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
      case "FORCE_CLOSED":
        return "#e11d48"; // rose-600 for force closed
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

  const getActivationMessage = (item: ScheduledTrip): string => {
    if (!item.activationStatus) return "";
    
    if (!isOnline) {
      return "Go online to start this trip";
    }
    
    if (item.activationStatus.canActivate) {
      return "Ready to start!";
    }
    
    if (item.activationStatus.isTooEarly) {
      return `Too early. Earliest start: ${new Date(item.activationStatus.earliestStartTime || item.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    
    if (item.activationStatus.distanceToFirstPoint !== undefined && item.activationStatus.distanceToFirstPoint > 5000) {
      return `Too far from first checkpoint (${(item.activationStatus.distanceToFirstPoint / 1000).toFixed(1)} km away)`;
    }
    
    return item.activationStatus.reason || "Not ready yet";
  };

  const renderTripItem = ({ item }: { item: ScheduledTrip }) => {
    const dateTime = formatDateTime(item.scheduledTime);
    const statusColor = getStatusColor(item.status);
    // Trip can only be started if: captain is online AND activation conditions are met
    const canStart = isOnline && item.activationStatus?.canActivate && item.status === "SCHEDULED";
    const activationMessage = getActivationMessage(item);

    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.sm,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={{ fontSize: fontSizes.FONT20, fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.xs }}>
              {item.name}
            </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" }}>
                {item.company?.name && (
                  <View
                    style={{
                      backgroundColor: color.primary + "15",
                      borderColor: color.primary,
                      borderWidth: 1,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs / 1.5,
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
                      {item.company.name}
                    </Text>
                  </View>
                )}
              </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Calender colors={color.text.secondary} width={14} height={14} />
              <Text style={{ color: color.text.secondary, fontSize: fontSizes.FONT14, fontFamily: fonts.regular }}>
                {dateTime.date} at {dateTime.time}
              </Text>
            </View>
          </View>
          <StatusBadge 
            status={
              item.status === "SCHEDULED" ? "scheduled" :
              item.status === "ACTIVE" ? "active" :
              item.status === "COMPLETED" ? "completed" :
              item.status === "CANCELLED" ? "cancelled" :
              item.status === "FORCE_CLOSED" ? "forceClosed" :
              "failed"
            } 
            size="sm"
          />
        </View>

        {/* Checkpoints Info */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.sm }}>
          <LocationIcon color={color.text.secondary} width={14} height={14} />
          <Text style={{ color: colors.text, fontSize: fontSizes.FONT14, fontFamily: fonts.regular }}>
            {item.points?.length || 0} checkpoint{item.points?.length !== 1 ? "s" : ""}
          </Text>
          {item.points && item.points.length > 0 && (
            <Text style={{ color: color.text.secondary, fontSize: fontSizes.FONT12 }}>
              • {item.points[0].name} → {item.points[item.points.length - 1].name}
            </Text>
          )}
        </View>

        {/* Activation Status */}
        {item.activationStatus && item.status === "SCHEDULED" && (
          <View
            style={{
              backgroundColor: canStart ? color.semantic.successLight : color.semantic.warningLight,
              padding: spacing.md,
              borderRadius: 8,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: canStart ? color.semantic.success : color.semantic.warning,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <Text style={{ fontSize: 16 }}>
                {canStart ? "✓" : "⏳"}
              </Text>
              <Text
                style={{
                  color: canStart ? color.semantic.success : color.semantic.warning,
                  fontSize: fontSizes.FONT14,
                  fontFamily: fonts.medium,
                  flex: 1,
                }}
              >
                {activationMessage}
              </Text>
            </View>
            {isOnline && item.activationStatus.distanceToFirstPoint !== undefined && item.activationStatus.distanceToFirstPoint <= 5000 && (
              <Text style={{ color: color.text.secondary, fontSize: fontSizes.FONT12, marginTop: spacing.xs / 2 }}>
                {((item.activationStatus.distanceToFirstPoint || 0) / 1000).toFixed(2)} km from first checkpoint
              </Text>
            )}
          </View>
        )}

        {/* Action Buttons */}
        {item.status === "FAILED" ? (
          <View
            style={{
              backgroundColor: color.semantic.errorLight,
              padding: spacing.md,
              borderRadius: 8,
              alignItems: "center",
              borderWidth: 1,
              borderColor: color.semantic.error,
            }}
          >
            <Text style={{ color: color.semantic.error, fontFamily: fonts.bold, fontSize: fontSizes.FONT14 }}>
              ❌ Trip Failed (Overdue)
            </Text>
          </View>
        ) : item.status === "FORCE_CLOSED" ? (
          <View
            style={{
              backgroundColor: "#fce7f3", // rose-100
              padding: spacing.md,
              borderRadius: 8,
              alignItems: "center",
              borderWidth: 1,
              borderColor: color.status.forceClosed,
            }}
          >
            <Text style={{ color: color.status.forceClosed, fontFamily: fonts.bold, fontSize: fontSizes.FONT14 }}>
              ⚠️ Trip Force Closed
            </Text>
            <Text style={{ color: color.status.forceClosed, fontFamily: fonts.regular, fontSize: fontSizes.FONT12, marginTop: spacing.xs }}>
              This trip was closed by admin. A deduction has been applied.
            </Text>
          </View>
        ) : item.status === "SCHEDULED" ? (
          <TouchableOpacity
            onPress={() => handleStartTrip(item)}
            disabled={!canStart || startingTrip === item.id}
            style={{
              backgroundColor: canStart ? color.primary : color.border,
              padding: spacing.md,
              borderRadius: 8,
              alignItems: "center",
              opacity: startingTrip === item.id ? 0.6 : canStart ? 1 : 0.6,
              minHeight: 44,
              justifyContent: "center",
            }}
            activeOpacity={0.7}
          >
            {startingTrip === item.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontFamily: fonts.bold, fontSize: fontSizes.FONT16 }}>
                Start Trip
              </Text>
            )}
          </TouchableOpacity>
        ) : item.status === "ACTIVE" ? (
          <TouchableOpacity
            onPress={() => {
              router.push({
                pathname: "/trip-navigation",
                params: { tripId: item.id },
              });
            }}
            style={{
              backgroundColor: color.primary,
              padding: spacing.md,
              borderRadius: 8,
              alignItems: "center",
              minHeight: 44,
              justifyContent: "center",
            }}
            activeOpacity={0.7}
          >
            <Text style={{ color: "#fff", fontFamily: fonts.bold, fontSize: fontSizes.FONT16 }}>
              Continue Trip
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const handleBackToHome = () => {
    router.push("/(tabs)/home");
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
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
        <View style={{ flex: 1, padding: spacing.lg }}>
          <SkeletonList count={3} />
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
      <DateSelector
        dates={weekDates}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />
      <FlatList
        data={trips}
        renderItem={renderTripItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            title="No Scheduled Trips"
            message={`You don't have any scheduled trips for ${selectedDate.toLocaleDateString()}. Try selecting a different date.`}
            actionLabel="Go to Home"
            onAction={() => router.push("/(tabs)/home")}
          />
        }
      />
    </View>
  );
}

