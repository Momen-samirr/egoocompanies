import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { getServerUri } from "@/configs/constants";
import { useTripActivation } from "@/contexts/TripActivationContext";

interface DriverStats {
  completedTripsToday: number;
  failedTrips: number;
  upcomingScheduledTrips: number;
  activeTrip: {
    type: "scheduled" | "regular";
    id: string;
    name: string;
  } | null;
  totalCompletedTrips: number;
}

interface ScheduledTripPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  isFinalPoint: boolean;
  reachedAt?: string | null;
}

interface ScheduledTrip {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED" | "FORCE_CLOSED";
  price?: number;
  points?: ScheduledTripPoint[];
}

export interface HomeDashboardData {
  stats: DriverStats | null;
  scheduledTrips: ScheduledTrip[];
  todayEarnings: number;
  tripsDone: number;
  totalHours: number;
  activeRoute: {
    title: string;
    currentStop: string;
    nextStop: string;
    etaMinutes: number;
  };
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const isSameCalendarDay = (firstDate: Date, secondDate: Date): boolean => {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
};

const calculateTodayEarningsFromScheduled = (scheduledTrips: ScheduledTrip[]): number => {
  const now = new Date();
  return scheduledTrips.reduce((sum, trip) => {
    if (trip.status !== "COMPLETED") return sum;
    const tripDate = new Date(trip.tripDate || trip.scheduledTime);
    if (Number.isNaN(tripDate.getTime()) || !isSameCalendarDay(tripDate, now)) return sum;
    return sum + toNumber(trip.price);
  }, 0);
};

const estimateTotalHours = (fallbackTripsDone: number): number => {
  return fallbackTripsDone * 0.8;
};

const buildActiveRoute = (
  stats: DriverStats | null,
  scheduledTrips: ScheduledTrip[],
  t: TFunction<"home">
): HomeDashboardData["activeRoute"] => {
  const matchedActiveTrip = stats?.activeTrip
    ? scheduledTrips.find((trip) => trip.id === stats.activeTrip?.id) || null
    : null;
  const activeTripFromList =
    matchedActiveTrip || scheduledTrips.find((trip) => trip.status === "ACTIVE") || null;
  const firstPoint = activeTripFromList?.points?.[0];
  const lastPoint =
    activeTripFromList?.points?.[activeTripFromList.points.length - 1] || firstPoint;

  return {
    title:
      stats?.activeTrip?.name ||
      activeTripFromList?.name ||
      t("noActiveRoute"),
    currentStop: firstPoint?.name || t("waitingAssignment"),
    nextStop: lastPoint?.name || t("noUpcomingStop"),
    etaMinutes: activeTripFromList ? 4 : 0,
  };
};

const sortUpcomingTrips = (trips: ScheduledTrip[]): ScheduledTrip[] => {
  return [...trips]
    .filter((trip) => trip.status === "SCHEDULED" || trip.status === "ACTIVE")
    .sort((firstTrip, secondTrip) => {
      const firstTime = new Date(firstTrip.scheduledTime).getTime();
      const secondTime = new Date(secondTrip.scheduledTime).getTime();
      return firstTime - secondTime;
    });
};

export const useHomeDashboardData = () => {
  const { t } = useTranslation("home");
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [scheduledTrips, setScheduledTrips] = useState<ScheduledTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { activationVersion } = useTripActivation();
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const fetchDashboardData = useCallback(async (showLoader = true) => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setStats(null);
        setScheduledTrips([]);
        return;
      }

      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

      const [statsResponse, scheduledTripsResponse] = await Promise.all([
        axios.get(`${getServerUri()}/driver/stats`, { headers }),
        axios.get(`${getServerUri()}/driver/scheduled-trips`, { headers }),
      ]);

      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      setStats(statsResponse.data?.success ? statsResponse.data.stats || null : null);
      setScheduledTrips(
        scheduledTripsResponse.data?.success ? scheduledTripsResponse.data.trips || [] : []
      );
    } catch (error) {
      console.error("Error fetching home dashboard data:", error);
    } finally {
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData, activationVersion]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const data: HomeDashboardData = useMemo(() => {
    const upcomingTrips = sortUpcomingTrips(scheduledTrips);
    const tripsDone = stats?.completedTripsToday ?? 0;
    const todayEarnings = calculateTodayEarningsFromScheduled(scheduledTrips);
    const totalHours = estimateTotalHours(tripsDone);
    const activeRoute = buildActiveRoute(stats, scheduledTrips, t);

    return {
      stats,
      scheduledTrips: upcomingTrips,
      todayEarnings,
      tripsDone,
      totalHours,
      activeRoute,
    };
  }, [scheduledTrips, stats, t]);

  return {
    loading,
    refreshing,
    data,
    refreshDashboardData: () => fetchDashboardData(false),
    revalidateDashboardData: () => fetchDashboardData(true),
  };
};
