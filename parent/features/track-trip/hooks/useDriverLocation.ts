/**
 * Hook for managing driver location state from WebSocket
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { DriverLocation, Coordinate } from "../types";
import { hasCoordinateChanged } from "../utils/coordinates";
import { COORDINATE_CHANGE_THRESHOLD } from "../constants";

/**
 * Options for useDriverLocation hook
 */
export interface UseDriverLocationOptions {
  location: DriverLocation | null | undefined;
  onLocationChange?: (location: DriverLocation) => void;
}

/**
 * Return type for useDriverLocation hook
 */
export interface UseDriverLocationReturn {
  driverLocation: DriverLocation | null;
  driverCoordinate: Coordinate | null;
  hasLocation: boolean;
  locationTimestamp: string | null;
}

/**
 * Hook to manage driver location state and coordinate memoization
 */
export function useDriverLocation({
  location,
  onLocationChange,
}: UseDriverLocationOptions): UseDriverLocationReturn {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(
    location || null
  );
  const prevLocationRef = useRef<DriverLocation | null>(null);

  // Update location state when prop changes
  useEffect(() => {
    if (!location) {
      setDriverLocation(null);
      prevLocationRef.current = null;
      return;
    }

    const prev = prevLocationRef.current;
    const coordsChanged =
      !prev ||
      hasCoordinateChanged(prev, location, COORDINATE_CHANGE_THRESHOLD) ||
      (prev.heading !== location.heading &&
        location.heading !== undefined);

    if (coordsChanged) {
      console.log("[useDriverLocation] Coordinates changed, updating driver location:", {
        prev: prev ? { lat: prev.latitude, lng: prev.longitude, heading: prev.heading } : null,
        current: { lat: location.latitude, lng: location.longitude, heading: location.heading },
      });
      setDriverLocation(location);
      prevLocationRef.current = location;

      if (onLocationChange) {
        onLocationChange(location);
      }
    } else {
      console.log("[useDriverLocation] Coordinates unchanged, skipping update");
    }
  }, [
    location?.latitude,
    location?.longitude,
    location?.heading,
    onLocationChange,
  ]);

  // Memoize coordinate to ensure new reference when coordinates change
  // Always create new object to ensure reference change triggers re-renders
  const driverCoordinate = useMemo<Coordinate | null>(() => {
    if (!driverLocation) {
      return null;
    }

    return {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
    };
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  return {
    driverLocation,
    driverCoordinate,
    hasLocation: !!driverLocation,
    locationTimestamp: driverLocation ? new Date().toISOString() : null,
  };
}

