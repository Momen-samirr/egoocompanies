import axios from "axios";
import { getServerUri } from "@/configs/constants";
import { calculateDistance } from "@/utils/haversine";

export interface ScheduledTripPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  isFinalPoint: boolean;
  reachedAt: string | null;
  employees?: Array<{ name: string; employeeId?: string }> | null;
}

export interface ScheduledTripItem {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  status:
    | "SCHEDULED"
    | "ACTIVE"
    | "COMPLETED"
    | "CANCELLED"
    | "FAILED"
    | "FORCE_CLOSED"
    | "PENDING"
    | "NOT_STARTED"
    | "pending"
    | "not_started"
    | string;
  companyId?: string;
  price?: number;
  company?: {
    id: string;
    name: string;
  };
  points: ScheduledTripPoint[];
  activationStatus: {
    canActivate: boolean;
    reason?: string;
    distanceToFirstPoint?: number;
    isWithinTimeWindow?: boolean;
    isTooEarly?: boolean;
    earliestStartTime?: string;
  } | null;
}

interface FetchTripsOptions {
  date?: string;
  latitude?: number;
  longitude?: number;
}

export const fetchScheduledTrips = async (
  accessToken: string,
  options: FetchTripsOptions = {}
): Promise<ScheduledTripItem[]> => {
  const params = new URLSearchParams();
  if (options.date) params.append("date", options.date);
  if (typeof options.latitude === "number")
    params.append("latitude", String(options.latitude));
  if (typeof options.longitude === "number")
    params.append("longitude", String(options.longitude));

  const query = params.toString();
  const url = `${getServerUri()}/driver/scheduled-trips${query ? `?${query}` : ""}`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data?.success ? response.data.trips || [] : [];
};

export const startScheduledTrip = async (
  accessToken: string,
  tripId: string,
  latitude: number,
  longitude: number
) => {
  return axios.post(
    `${getServerUri()}/driver/start-trip/${tripId}`,
    { latitude, longitude },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
};

const estimateTripDistanceKm = (points: ScheduledTripPoint[]): number => {
  if (!points || points.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    totalMeters += calculateDistance(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude
    );
  }
  return totalMeters / 1000;
};

export const calculateWeeklyTripMetrics = (trips: ScheduledTripItem[]) => {
  const totalMilesWeek = trips.reduce((sum, trip) => {
    return sum + estimateTripDistanceKm(trip.points) * 0.621371;
  }, 0);

  const completed = trips.filter((trip) => trip.status === "COMPLETED").length;
  const nonSuccess = trips.filter((trip) =>
    ["FAILED", "CANCELLED", "FORCE_CLOSED"].includes(trip.status)
  ).length;
  const totalEvaluated = completed + nonSuccess;
  const efficiencyScore =
    totalEvaluated > 0 ? (completed / totalEvaluated) * 100 : 100;

  return {
    totalMilesWeek,
    efficiencyScore,
  };
};

export const getActivationMessage = (
  item: ScheduledTripItem,
  isOnline: boolean,
  t: (key: string, options?: Record<string, unknown>) => string
): string => {
  if (!item.activationStatus) return "";

  if (!isOnline) {
    return t("goOnlineToActivate");
  }

  if (item.activationStatus.canActivate) {
    return t("readyToActivate");
  }

  if (item.activationStatus.isTooEarly) {
    return t("activationWindowNotOpen");
  }

  if (
    item.activationStatus.distanceToFirstPoint !== undefined &&
    item.activationStatus.distanceToFirstPoint > 5000
  ) {
    return t("tooFarFromStart", {
      km: (item.activationStatus.distanceToFirstPoint / 1000).toFixed(1),
    });
  }

  return item.activationStatus.reason || t("cannotActivateYet");
};

export type TripActionType = "activate" | "continue" | "failed" | "disabled";

export interface TripActionState {
  actionType: TripActionType;
  label: string;
  disabled: boolean;
  backgroundColor: string;
  textColor: string;
  /** When true, UI should show a localized "activating" label instead of `label`. */
  isActivating?: boolean;
}

export const normalizeTripStatus = (status?: string | null): string => {
  if (!status) return "PENDING";
  return status.toString().trim().toUpperCase();
};

export const getTripActionState = (params: {
  status?: string | null;
  canActivate: boolean;
  isOnline: boolean;
  isActivating: boolean;
}): TripActionState => {
  const normalizedStatus = normalizeTripStatus(params.status);

  if (params.isActivating) {
    return {
      actionType: "disabled",
      label: "Activating...",
      disabled: true,
      backgroundColor: "#9CA3AF",
      textColor: "#FFFFFF",
      isActivating: true,
    };
  }

  if (normalizedStatus === "ACTIVE") {
    return {
      actionType: "continue",
      label: "Continue Trip",
      disabled: false,
      backgroundColor: "#10B981",
      textColor: "#FFFFFF",
    };
  }

  if (normalizedStatus === "FAILED") {
    return {
      actionType: "failed",
      label: "Trip Failed",
      disabled: true,
      backgroundColor: "#F1F2F4",
      textColor: "#9CA3AF",
    };
  }

  if (
    normalizedStatus === "SCHEDULED" ||
    normalizedStatus === "PENDING" ||
    normalizedStatus === "NOT_STARTED"
  ) {
    const activationEnabled = params.isOnline && params.canActivate;
    return {
      actionType: "activate",
      label: "Activate Trip",
      disabled: !activationEnabled,
      backgroundColor: activationEnabled ? "#4648D4" : "#F1F2F4",
      textColor: activationEnabled ? "#FFFFFF" : "#9CA3AF",
    };
  }

  return {
    actionType: "disabled",
    label: "Unavailable",
    disabled: true,
    backgroundColor: "#F1F2F4",
    textColor: "#9CA3AF",
  };
};
