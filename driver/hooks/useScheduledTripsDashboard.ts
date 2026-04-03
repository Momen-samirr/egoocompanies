import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router } from "expo-router";
import { Toast } from "react-native-toast-notifications";
import {
  calculateWeeklyTripMetrics,
  fetchScheduledTrips,
  ScheduledTripItem,
} from "@/services/scheduledTripsService";
import { formatDateForAPI, getCurrentWeek, isSameDay } from "@/utils/weekGenerator";
import { useTripActivation } from "@/contexts/TripActivationContext";

export const useScheduledTripsDashboard = (driverStatus?: string) => {
  const { t } = useTranslation("trips");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekDates] = useState<Date[]>(getCurrentWeek());
  const [dayTrips, setDayTrips] = useState<ScheduledTripItem[]>([]);
  const [weekTrips, setWeekTrips] = useState<ScheduledTripItem[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const {
    activeTripId,
    activatingTripId,
    activateTrip: activateTripAction,
  } = useTripActivation();

  useEffect(() => {
    if (driverStatus) {
      setIsOnline(driverStatus === "active");
    }
  }, [driverStatus]);

  const fetchDashboardData = useCallback(
    async (refreshOnly = false) => {
      try {
        if (refreshOnly) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const accessToken = await AsyncStorage.getItem("accessToken");
        if (!accessToken) {
          Toast.show(t("loginFirst"), { type: "danger" });
          return;
        }

        const storedStatus = await AsyncStorage.getItem("status");
        if (storedStatus) {
          setIsOnline(storedStatus === "active");
        }

        const options: { date?: string; latitude?: number; longitude?: number } = {
          date: formatDateForAPI(selectedDate),
        };

        try {
          const permission = await Location.getForegroundPermissionsAsync();
          if (
            permission.status === "granted" ||
            permission.status === "undetermined"
          ) {
            const granted =
              permission.status === "granted"
                ? permission
                : await Location.requestForegroundPermissionsAsync();
            if (granted.status === "granted") {
              const location = await Location.getCurrentPositionAsync({});
              options.latitude = location.coords.latitude;
              options.longitude = location.coords.longitude;
            }
          }
        } catch (error) {
          console.log("Scheduled trips: location not available", error);
        }

        const [selectedDayResponse, allTripsResponse] = await Promise.all([
          fetchScheduledTrips(accessToken, options),
          fetchScheduledTrips(accessToken),
        ]);

        const selectedDayTrips = selectedDayResponse.filter((trip) =>
          isSameDay(new Date(trip.tripDate || trip.scheduledTime), selectedDate)
        );

        const weekStart = new Date(weekDates[0]);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekDates[weekDates.length - 1]);
        weekEnd.setHours(23, 59, 59, 999);

        const currentWeekTrips = allTripsResponse.filter((trip) => {
          const tripDate = new Date(trip.tripDate || trip.scheduledTime);
          return tripDate >= weekStart && tripDate <= weekEnd;
        });

        // Keep locally persisted active trip reflected immediately in UI.
        const applyStatus = (trip: ScheduledTripItem): ScheduledTripItem => {
          if (statusOverrides[trip.id]) {
            return { ...trip, status: statusOverrides[trip.id] };
          }
          if (activeTripId && trip.id === activeTripId) {
            return { ...trip, status: "ACTIVE" };
          }
          return trip;
        };

        setDayTrips(selectedDayTrips.map(applyStatus));
        setWeekTrips(currentWeekTrips.map(applyStatus));
      } catch (error: any) {
        console.error("Error fetching scheduled trips dashboard:", error);
        Toast.show(error.response?.data?.message || t("loadTripsFailed"), {
          type: "danger",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate, weekDates, activeTripId, statusOverrides, t]
  );

  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  const handleRefresh = useCallback(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  const activateTrip = useCallback(
    async (trip: ScheduledTripItem) => {
      try {
        if (activeTripId && activeTripId !== trip.id) {
          Toast.show(t("anotherTripActive"), { type: "warning" });
          return;
        }

        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          Toast.show(t("locationRequired"), { type: "danger" });
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        await activateTripAction({
          tripId: trip.id,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setStatusOverrides((previous) => ({
          ...previous,
          [trip.id]: "ACTIVE",
        }));
        Toast.show(t("tripStarted"), { type: "success" });
        router.push({
          pathname: "/trip-navigation",
          params: { tripId: trip.id },
        });
      } catch (error: any) {
        console.error("Error starting trip:", error);
        if (error?.response) {
          setStatusOverrides((previous) => ({
            ...previous,
            [trip.id]: "FAILED",
          }));
        }
        Toast.show(
          error.response?.data?.message || error.message || t("startTripFailed"),
          {
            type: "danger",
          }
        );
      } finally {
        fetchDashboardData(true);
      }
    },
    [fetchDashboardData, activateTripAction, activeTripId, t]
  );

  const continueTrip = useCallback((tripId: string) => {
    router.push({
      pathname: "/trip-navigation",
      params: { tripId },
    });
  }, []);

  const metrics = useMemo(() => calculateWeeklyTripMetrics(weekTrips), [weekTrips]);

  return {
    selectedDate,
    setSelectedDate,
    weekDates,
    dayTrips,
    loading,
    refreshing,
    isOnline,
    startingTripId: activatingTripId,
    activeTripId,
    metrics,
    handleRefresh,
    activateTrip,
    continueTrip,
  };
};
