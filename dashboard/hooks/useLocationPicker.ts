"use client";

import { useState, useCallback } from "react";
import { LocationData } from "@/types/trip";
import { getDefaultMapCenter } from "@/lib/utils/maps";

export interface UseLocationPickerReturn {
  location: LocationData | null;
  setLocation: (location: LocationData | null) => void;
  clearLocation: () => void;
  hasLocation: boolean;
  mapCenter: { lat: number; lng: number };
  setMapCenter: (center: { lat: number; lng: number }) => void;
}

export function useLocationPicker(
  initialLocation?: LocationData | null
): UseLocationPickerReturn {
  const [location, setLocation] = useState<LocationData | null>(
    initialLocation || null
  );
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
    initialLocation
      ? { lat: initialLocation.latitude, lng: initialLocation.longitude }
      : getDefaultMapCenter()
  );

  const clearLocation = useCallback(() => {
    setLocation(null);
  }, []);

  const handleSetLocation = useCallback((newLocation: LocationData | null) => {
    setLocation(newLocation);
    if (newLocation) {
      setMapCenter({
        lat: newLocation.latitude,
        lng: newLocation.longitude,
      });
    }
  }, []);

  return {
    location,
    setLocation: handleSetLocation,
    clearLocation,
    hasLocation: location !== null,
    mapCenter,
    setMapCenter,
  };
}

