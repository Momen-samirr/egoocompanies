import React, { useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { useTheme } from "@react-navigation/native";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { useNavigation } from "@/hooks/useNavigation";
import { Coordinate } from "@/services/navigationService";
import NavigationArrow from "@/components/navigation/NavigationArrow";
import TurnByTurnCard from "@/components/navigation/TurnByTurnCard";
import ETADisplay from "@/components/common/ETADisplay";
import { animateCameraToDriver } from "@/utils/mapCamera";
import { windowHeight, windowWidth, fontSizes } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { spacing, shadows } from "@/styles/design-system";
import Constants from "expo-constants";

interface NavigationScreenProps {
  origin: Coordinate;
  destination: Coordinate;
  mode: "pickup" | "destination";
  onClose?: () => void;
  onArrival?: () => void;
}

export default function NavigationScreen({
  origin,
  destination,
  mode,
  onClose,
  onArrival,
}: NavigationScreenProps) {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);

  const {
    state,
    startNavigation,
    stopNavigation,
    recalculateCurrentRoute,
  } = useNavigation({
    origin,
    destination,
    mode,
    enabled: true,
    onArrival: () => {
      console.log("✅ Arrived at destination");
      if (onArrival) {
        onArrival();
      }
    },
    onDeviation: () => {
      console.log("⚠️ Route recalculated due to deviation");
    },
  });

  // Start navigation when component mounts
  useEffect(() => {
    startNavigation();
    return () => {
      stopNavigation();
    };
  }, []);

  // Update map camera to follow driver
  useEffect(() => {
    if (
      state.currentLocation &&
      destination &&
      state.isActive &&
      mapRef.current
    ) {
      animateCameraToDriver(
        mapRef.current,
        state.currentLocation,
        destination,
        state.driverHeading,
        true // navigation mode
      );
    }
  }, [state.currentLocation, state.driverHeading, destination, state.isActive]);

  // Center map button handler
  const handleCenterMap = useCallback(() => {
    if (state.currentLocation && destination && mapRef.current) {
      animateCameraToDriver(
        mapRef.current,
        state.currentLocation,
        destination,
        state.driverHeading,
        true
      );
    }
  }, [state.currentLocation, state.driverHeading, destination]);

  // Get Google Maps API key
  const getApiKey = (): string => {
    const envKey = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
    const configKey = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
    return envKey || configKey || "";
  };

  const apiKey = getApiKey();

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        showsMyLocationButton={false}
        followsUserLocation={false}
        rotateEnabled={true}
        pitchEnabled={true}
        scrollEnabled={false}
        zoomEnabled={false}
        initialRegion={{
          latitude: origin.latitude,
          longitude: origin.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* Destination Marker */}
        <Marker
          coordinate={destination}
          title={mode === "pickup" ? "Pickup Location" : "Destination"}
          pinColor={mode === "pickup" ? color.status.active : color.status.completed}
        />

        {/* Route Polyline */}
        {state.route && state.currentLocation && (
          <MapViewDirections
            origin={state.currentLocation}
            destination={destination}
            apikey={apiKey}
            strokeWidth={5}
            strokeColor={color.primary}
            onReady={(result) => {
              // Route is ready
              console.log("✅ Route rendered on map");
            }}
            onError={(error) => {
              console.error("❌ Error rendering route:", error);
            }}
          />
        )}
      </MapView>

      {/* Turn-by-Turn Instructions Card */}
      {state.nextTurn && (
        <TurnByTurnCard
          step={state.nextTurn.step}
          distanceToTurn={state.nextTurn.distanceToTurn}
          visible={state.isActive}
        />
      )}

      {/* Top Bar - Mode and Close Button */}
      <View style={[styles.topBar, { backgroundColor: colors.card }, shadows.md]}>
        <View style={styles.topBarContent}>
          <View style={styles.modeContainer}>
            <Text style={[styles.modeText, { color: colors.text }]}>
              {mode === "pickup" ? "📍 To Pickup" : "🎯 To Destination"}
            </Text>
          </View>
          {onClose && (
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.border }]}
            >
              <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bottom Bar - ETA and Distance */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card }, shadows.lg]}>
        <View style={styles.bottomBarContent}>
          <View style={styles.etaContainer}>
            <Text style={[styles.etaLabel, { color: color.text.secondary }]}>
              {mode === "pickup" ? "ETA to Pickup" : "ETA to Destination"}
            </Text>
            <ETADisplay
              distance={state.distanceToDestination}
              duration={state.etaToDestination}
              size="lg"
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              onPress={handleCenterMap}
              style={[styles.actionButton, { backgroundColor: colors.background }]}
            >
              <Text style={styles.actionButtonIcon}>📍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={recalculateCurrentRoute}
              style={[styles.actionButton, { backgroundColor: colors.background }]}
              disabled={state.isLoading}
            >
              {state.isLoading ? (
                <ActivityIndicator size="small" color={color.primary} />
              ) : (
                <Text style={styles.actionButtonIcon}>🔄</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Navigation Arrow */}
      {state.bearingToDestination !== null && (
        <NavigationArrow
          bearingToDestination={state.bearingToDestination}
          driverHeading={state.driverHeading}
          visible={state.isActive}
        />
      )}

      {/* Loading Overlay */}
      {state.isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={color.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Calculating route...
          </Text>
        </View>
      )}

      {/* Error Message */}
      {state.error && (
        <View style={[styles.errorContainer, { backgroundColor: color.semantic.errorLight }]}>
          <Text style={[styles.errorText, { color: color.semantic.error }]}>
            {state.error}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background.primary,
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    zIndex: 1000,
  },
  topBarContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modeContainer: {
    flex: 1,
  },
  modeText: {
    fontSize: fontSizes.FONT18,
    fontFamily: fonts.bold,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: fontSizes.FONT18,
    fontWeight: "bold",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 1000,
  },
  bottomBarContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  etaContainer: {
    flex: 1,
  },
  etaLabel: {
    fontSize: fontSizes.FONT12,
    fontFamily: fonts.regular,
    marginBottom: spacing.xs,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  actionButtonIcon: {
    fontSize: 20,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
  },
  errorContainer: {
    position: "absolute",
    top: 100,
    left: spacing.md,
    right: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    zIndex: 2000,
  },
  errorText: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
    textAlign: "center",
  },
});

