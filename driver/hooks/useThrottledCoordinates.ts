import { useState, useEffect, useRef } from "react";
import { calculateDistance } from "@/utils/haversine";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Hook to throttle coordinate updates based on distance and time thresholds
 * Only updates when the new coordinates are:
 * - More than distanceThreshold meters away from the last emitted coordinates, OR
 * - More than timeThreshold milliseconds have passed since the last update
 * 
 * @param coordinates Current coordinates (can be null/undefined)
 * @param distanceThreshold Distance threshold in meters (default: 100m)
 * @param timeThreshold Time threshold in milliseconds (default: 60000 = 60s)
 * @returns Throttled coordinates that only update when thresholds are met
 */
export function useThrottledCoordinates(
  coordinates: Coordinates | null | undefined,
  distanceThreshold: number = 100,
  timeThreshold: number = 60000
): Coordinates | null {
  const [throttledCoords, setThrottledCoords] = useState<Coordinates | null>(null);
  const lastEmittedRef = useRef<Coordinates | null>(null);
  const lastEmittedTimeRef = useRef<number>(0);

  useEffect(() => {
    // If no coordinates provided, clear throttled coords
    if (!coordinates) {
      setThrottledCoords(null);
      return;
    }

    const now = Date.now();
    const shouldUpdate =
      // First update (no previous coordinates)
      lastEmittedRef.current === null ||
      // Time threshold exceeded
      now - lastEmittedTimeRef.current >= timeThreshold ||
      // Distance threshold exceeded
      calculateDistance(
        coordinates.latitude,
        coordinates.longitude,
        lastEmittedRef.current.latitude,
        lastEmittedRef.current.longitude
      ) >= distanceThreshold;

    if (shouldUpdate) {
      setThrottledCoords({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      lastEmittedRef.current = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      };
      lastEmittedTimeRef.current = now;
    }
  }, [coordinates?.latitude, coordinates?.longitude, distanceThreshold, timeThreshold]);

  return throttledCoords;
}

