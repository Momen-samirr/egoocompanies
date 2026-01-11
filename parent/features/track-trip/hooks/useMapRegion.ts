/**
 * Hook for managing map region updates
 */

import { useState, useEffect, useRef } from "react";
import { Region } from "react-native-maps";
import { Trip, Coordinate } from "../types";
import { calculateMapRegion } from "../services/map.service";

/**
 * Options for useMapRegion hook
 */
export interface UseMapRegionOptions {
  trip: Trip | null;
  driverLocation: Coordinate | null;
  onRegionChange?: (region: Region) => void;
}

/**
 * Return type for useMapRegion hook
 */
export interface UseMapRegionReturn {
  region: Region | null;
  updateRegion: () => void;
}

/**
 * Hook to calculate and update map region based on trip points and driver location
 */
export function useMapRegion({
  trip,
  driverLocation,
  onRegionChange,
}: UseMapRegionOptions): UseMapRegionReturn {
  const [region, setRegion] = useState<Region | null>(null);
  const prevTripIdRef = useRef<string | null>(null);
  const prevLocationRef = useRef<Coordinate | null>(null);
  const mapRef = useRef<any>(null);

  const updateRegion = () => {
    if (!trip?.points || trip.points.length === 0) {
      return;
    }

    const points: Coordinate[] = trip.points.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    const newRegion = calculateMapRegion(points, driverLocation);
    if (newRegion) {
      setRegion(newRegion);

      // Animate to new region if map ref is available
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }

      if (onRegionChange) {
        onRegionChange(newRegion);
      }
    }
  };

  // Update region when trip ID or driver location changes
  useEffect(() => {
    const tripIdChanged = prevTripIdRef.current !== trip?.id;
    const locationChanged =
      prevLocationRef.current?.latitude !== driverLocation?.latitude ||
      prevLocationRef.current?.longitude !== driverLocation?.longitude;

    if (tripIdChanged || locationChanged) {
      updateRegion();
      prevTripIdRef.current = trip?.id || null;
      if (driverLocation) {
        prevLocationRef.current = { ...driverLocation };
      }
    }
  }, [trip?.id, driverLocation?.latitude, driverLocation?.longitude]);

  // Set initial region when trip is first loaded
  useEffect(() => {
    if (trip?.points && trip.points.length > 0 && !region) {
      updateRegion();
    }
  }, [trip?.points?.length]);

  return {
    region,
    updateRegion,
  };
}

