import React, { useMemo, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import color from "@/themes/app.colors";
import { windowHeight } from "@/themes/app.constant";
import { spacing } from "@/styles/design-system";

interface HomeMapProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  pickupLocation: { latitude: number; longitude: number } | null;
  destinationLocation: { latitude: number; longitude: number } | null;
  onRegionChange?: (region: any) => void;
  onMapReady?: () => void;
  onError?: (error: any) => void;
  mapError?: string | null;
  mapLoading?: boolean;
}

/**
 * HomeMap Component
 * Displays map with pickup and destination markers
 */
export default React.memo(function HomeMap({
  region,
  pickupLocation,
  destinationLocation,
  onRegionChange,
  onMapReady,
  onError,
  mapError,
  mapLoading = true,
}: HomeMapProps) {
  // Memoize region to prevent unnecessary re-renders
  const memoizedRegion = useMemo(() => {
    return region;
  }, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  // Memoize markers
  const mapMarkers = useMemo(() => {
    return {
      pickup: pickupLocation,
      destination: destinationLocation,
    };
  }, [
    pickupLocation?.latitude,
    pickupLocation?.longitude,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
  ]);

  const handleRegionChange = useCallback(
    (newRegion: any) => {
      if (onRegionChange) {
        onRegionChange(newRegion);
      }
    },
    [onRegionChange]
  );

  const handleMapReady = useCallback(() => {
    if (onMapReady) {
      onMapReady();
    }
  }, [onMapReady]);

  const handleError = useCallback(
    (error: any) => {
      if (onError) {
        onError(error);
      }
    },
    [onError]
  );

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={memoizedRegion}
        onRegionChangeComplete={handleRegionChange}
        onMapReady={handleMapReady}
        onError={handleError}
        onDidFailLoadingMap={handleError}
      >
        {mapMarkers.destination && (
          <Marker coordinate={mapMarkers.destination} title="Destination" pinColor={color.status.active} />
        )}
        {mapMarkers.pickup && (
          <Marker coordinate={mapMarkers.pickup} title="Pickup" pinColor={color.status.completed} />
        )}
        {mapMarkers.pickup && mapMarkers.destination && (
          <MapViewDirections
            origin={mapMarkers.pickup}
            destination={mapMarkers.destination}
            apikey={process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY!}
            strokeWidth={4}
            strokeColor={color.primary}
          />
        )}
      </MapView>

      {/* Map Error Display */}
      {mapError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Map Error: {mapError}</Text>
        </View>
      )}

      {/* Map Loading Indicator */}
      {mapLoading && !mapError && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: windowHeight(300),
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  map: {
    flex: 1,
  },
  errorContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    padding: 12,
    borderRadius: 8,
    zIndex: 1000,
  },
  errorText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  loadingText: {
    color: "white",
    fontSize: 14,
  },
});

