import { calculateRoute, Coordinate } from "@/services/navigationService";
import { calculateDistance } from "@/utils/haversine";

export interface UpcomingStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  reachedAt?: string | null;
  expectedTime?: string | null;
}

export interface NextStopSelection {
  stopIndex: number;
  stop: UpcomingStop;
  straightLineDistanceKm: number;
}

export interface RouteMetrics {
  distanceKm: number;
  durationMin: number;
  source: "api" | "fallback";
}

const AVERAGE_SPEED_KMH_FALLBACK = 30;

const isValidCoordinate = (coordinate: Coordinate): boolean => {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
};

export const resolveClosestUpcomingStop = (
  points: UpcomingStop[],
  driverLocation: Coordinate,
  currentPointIndex: number
): NextStopSelection | null => {
  if (!points.length || !isValidCoordinate(driverLocation)) {
    return null;
  }

  const upcoming = points
    .map((point, index) => ({ point, index }))
    .filter(({ point, index }) => !point.reachedAt && index >= currentPointIndex);

  if (!upcoming.length) {
    return null;
  }

  let closest = upcoming[0];
  let closestDistanceMeters = Number.POSITIVE_INFINITY;

  for (const item of upcoming) {
    const rawLat = Number(item.point.latitude);
    const rawLng = Number(item.point.longitude);
    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
      continue;
    }

    const distanceMeters = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      rawLat,
      rawLng
    );

    if (distanceMeters < closestDistanceMeters) {
      closestDistanceMeters = distanceMeters;
      closest = item;
    }
  }

  return {
    stopIndex: closest.index,
    stop: closest.point,
    straightLineDistanceKm: closestDistanceMeters / 1000,
  };
};

export const getRoadRouteMetrics = async (
  origin: Coordinate,
  destination: Coordinate
): Promise<RouteMetrics> => {
  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    throw new Error("Invalid coordinates for route metrics");
  }

  try {
    const route = await calculateRoute(origin, destination);
    if (!route || !route.distance?.value || !route.duration?.value) {
      throw new Error("No route returned from directions API");
    }

    return {
      distanceKm: route.distance.value / 1000,
      durationMin: route.duration.value / 60,
      source: "api",
    };
  } catch (error) {
    const straightLineMeters = calculateDistance(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    );
    const straightLineKm = straightLineMeters / 1000;

    return {
      distanceKm: straightLineKm,
      durationMin: (straightLineKm / AVERAGE_SPEED_KMH_FALLBACK) * 60,
      source: "fallback",
    };
  }
};
