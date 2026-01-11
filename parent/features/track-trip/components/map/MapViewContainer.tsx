/**
 * MapView container component with region management
 */

import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Region } from "react-native-maps";
import { darkMapStyle } from "./darkMapStyle";
/**
 * Props for MapViewContainer component
 */
export interface MapViewContainerProps {
  region: Region | null;
  children: React.ReactNode;
  onRegionChange?: (region: Region) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  mapType?: "standard" | "satellite" | "hybrid" | "terrain" | "mutedStandard";
}

/**
 * MapView wrapper with automatic region updates and smooth animations
 */
export function MapViewContainer({
  region,
  children,
  onRegionChange,
  showsUserLocation = false,
  showsMyLocationButton = false,
  showsCompass = true,
  mapType = "standard",
}: MapViewContainerProps) {
  const mapRef = useRef<MapView>(null);
  const previousRegionRef = useRef<Region | null>(null);

  useEffect(() => {
    if (region && mapRef.current) {
      // Check if region has changed significantly
      const prev = previousRegionRef.current;
      if (
        !prev ||
        Math.abs(prev.latitude - region.latitude) > 0.001 ||
        Math.abs(prev.longitude - region.longitude) > 0.001 ||
        Math.abs(prev.latitudeDelta - region.latitudeDelta) > 0.001 ||
        Math.abs(prev.longitudeDelta - region.longitudeDelta) > 0.001
      ) {
        // Animate to new region smoothly
        mapRef.current.animateToRegion(region, 1000);
        previousRegionRef.current = region;

        if (onRegionChange) {
          onRegionChange(region);
        }
      }
    }
  }, [region, onRegionChange]);

  if (!region) {
    return null;
  }

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={region}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={showsMyLocationButton}
      showsCompass={showsCompass}
      mapType={mapType}
      customMapStyle={darkMapStyle}
      onRegionChangeComplete={onRegionChange}
    >
      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
