import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import React, { useEffect, useState, useRef } from "react";
import { useTheme } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { windowHeight, windowWidth, fontSizes } from "@/themes/app.constant";
import { Toast } from "react-native-toast-notifications";
import { useGetDriverData } from "@/hooks/useGetDriverData";
import { getServerUri } from "@/configs/constants";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import color from "@/themes/app.colors";
import { calculateDistance } from "@/utils/haversine";
import CheckpointCard from "@/components/trip/CheckpointCard";
import ETADisplay from "@/components/common/ETADisplay";
import EmergencyEndSlider from "@/components/trip/EmergencyEndSlider";
import { spacing, shadows } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import NavigationArrow from "@/components/navigation/NavigationArrow";
import NavigationScreen from "@/components/navigation/NavigationScreen";
import { calculateBearing, calculateHeadingFromMovement, Coordinate as NavCoordinate } from "@/utils/navigation.utils";
import { Coordinate } from "@/services/navigationService";
import { animateCameraToDriver } from "@/utils/mapCamera";
import { useNavigation } from "@/hooks/useNavigation";
import TurnByTurnCard from "@/components/navigation/TurnByTurnCard";
import { decodePolyline } from "@/services/navigationService";
import Constants from "expo-constants";

interface ScheduledTrip {
  id: string;
  name: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  companyId?: string;
  price?: number;
  company?: {
    id?: string;
    name: string;
  };
  points: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    isFinalPoint: boolean;
    reachedAt: string | null;
  }>;
  progress: {
    currentPointIndex: number;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
}

export default function TripNavigationScreen() {
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { driver } = useGetDriverData();
  const [trip, setTrip] = useState<ScheduledTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [distanceToCheckpoint, setDistanceToCheckpoint] = useState<number | undefined>(undefined);
  const [etaToCheckpoint, setEtaToCheckpoint] = useState<number | undefined>(undefined);
  const [canUseEmergency, setCanUseEmergency] = useState(true);
  const [emergencyDisabledMessage, setEmergencyDisabledMessage] = useState<string>("");
  const mapRef = useRef<MapView>(null);
  const locationWatchSubscription = useRef<Location.LocationSubscription | null>(null);
  
  // Navigation state
  const [driverHeading, setDriverHeading] = useState<number | null>(null);
  const [bearingToCheckpoint, setBearingToCheckpoint] = useState<number | null>(null);
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [isFullScreenNavigation, setIsFullScreenNavigation] = useState(false);
  const previousLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const hasShownProximityNotification = useRef<number | null>(null);
  
  // Navigation hook state
  const [navigationOrigin, setNavigationOrigin] = useState<Coordinate | null>(null);
  const [navigationDestination, setNavigationDestination] = useState<Coordinate | null>(null);
  
  // Track if we've manually started navigation to avoid conflicts
  const hasManuallyStartedNavigation = useRef(false);
  const navigationStartRequested = useRef(false);
  
  // Initialize navigation hook
  const {
    state: navigationState,
    startNavigation,
    stopNavigation,
    recalculateCurrentRoute,
  } = useNavigation({
    origin: navigationOrigin,
    destination: navigationDestination,
    mode: "destination",
    enabled: false, // Don't auto-start, we'll control it manually
    onArrival: () => {
      Toast.show("Arrived at checkpoint!", { type: "success" });
    },
    onDeviation: () => {
      console.log("⚠️ Route deviation detected, recalculating...");
    },
  });
  
  // Manually control navigation start/stop based on isNavigationMode
  useEffect(() => {
    if (isNavigationMode && navigationOrigin && navigationDestination) {
      // Only start if we haven't already requested it
      if (!navigationStartRequested.current) {
        navigationStartRequested.current = true;
        hasManuallyStartedNavigation.current = true;
        startNavigation().catch((error) => {
          console.error("Error starting navigation:", error);
          navigationStartRequested.current = false;
          hasManuallyStartedNavigation.current = false;
        });
      }
    } else if (!isNavigationMode) {
      navigationStartRequested.current = false;
      hasManuallyStartedNavigation.current = false;
      if (navigationState.isActive) {
        stopNavigation();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigationMode]);
  
  // Reset navigation start flag when origin/destination change
  useEffect(() => {
    navigationStartRequested.current = false;
  }, [navigationOrigin?.latitude, navigationOrigin?.longitude, navigationDestination?.latitude, navigationDestination?.longitude]);

  useEffect(() => {
    if (tripId) {
      fetchTrip();
      startLocationTracking();
      checkEmergencyUsageStatus();
    }
  }, [tripId]);

  // Update navigation origin when current location changes
  useEffect(() => {
    if (currentLocation) {
      setNavigationOrigin({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation?.coords.latitude, currentLocation?.coords.longitude]);

  // Update navigation destination when current checkpoint changes
  useEffect(() => {
    if (trip) {
      const currentPointIndex = trip.progress?.currentPointIndex || 0;
      const currentPoint = trip.points[currentPointIndex];
      
      if (currentPoint && !currentPoint.reachedAt) {
        setNavigationDestination({
          latitude: currentPoint.latitude,
          longitude: currentPoint.longitude,
        });
      } else {
        setNavigationDestination(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPointIndex]);

  // Cleanup navigation when mode is disabled
  useEffect(() => {
    if (!isNavigationMode && navigationState.isActive) {
      stopNavigation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigationMode]);

  const checkEmergencyUsageStatus = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        return;
      }

      const response = await axios.get(
        `${getServerUri()}/driver/emergency-usage-status`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        setCanUseEmergency(response.data.canUse);
        if (!response.data.canUse && response.data.message) {
          setEmergencyDisabledMessage(response.data.message);
        }
      }
    } catch (error: any) {
      console.error("Error checking emergency usage status:", error);
      // Default to allowing if check fails (fail open for safety)
      setCanUseEmergency(true);
    }
  };

  const fetchTrip = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        Toast.show("Please login first", { type: "danger" });
        return;
      }

      const response = await axios.get(
        `${getServerUri()}/driver/scheduled-trips?status=ACTIVE`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        const activeTrip = response.data.trips.find((t: ScheduledTrip) => t.id === tripId);
        if (activeTrip) {
          // Reset proximity notification flag when trip data changes
          const newCurrentPointIndex = activeTrip.progress?.currentPointIndex || 0;
          if (hasShownProximityNotification.current !== newCurrentPointIndex) {
            hasShownProximityNotification.current = null;
          }
          setTrip(activeTrip);
          // Wait for location to be available before updating map
          setTimeout(() => {
            if (currentLocation) {
              updateMapRegion(activeTrip);
              updateDistanceAndETA(currentLocation);
            }
          }, 500);
        } else {
          Toast.show("Trip not found or not active", { type: "danger" });
          router.back();
        }
      }
    } catch (error: any) {
      console.error("Error fetching trip:", error);
      Toast.show(error.response?.data?.message || "Failed to fetch trip", {
        type: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Toast.show("Location permission is required", { type: "danger" });
      return;
    }

    // Get initial location
    const location = await Location.getCurrentPositionAsync({});
    setCurrentLocation(location);
    updateDistanceAndETA(location);

    // Watch location updates
    locationWatchSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000, // Update every 2 seconds for better navigation
        distanceInterval: 5, // Update every 5 meters
        mayShowUserSettingsDialog: true,
      },
      (location) => {
        setCurrentLocation(location);
        updateDistanceAndETA(location);
        
        // Update heading
        const { latitude, longitude, heading } = location.coords;
        if (heading !== null && heading !== undefined && heading >= 0) {
          setDriverHeading(heading);
        } else if (previousLocation.current) {
          // Calculate heading from movement
          const calculatedHeading = calculateHeadingFromMovement(
            previousLocation.current as NavCoordinate,
            { latitude, longitude } as NavCoordinate
          );
          if (calculatedHeading !== null) {
            setDriverHeading(calculatedHeading);
          }
        }
        
        // Update bearing to current checkpoint and check proximity
        if (trip) {
          const currentPointIndex = trip.progress?.currentPointIndex || 0;
          const currentPoint = trip.points[currentPointIndex];
          if (currentPoint && !currentPoint.reachedAt) {
            const bearing = calculateBearing(
              { latitude, longitude } as NavCoordinate,
              { latitude: currentPoint.latitude, longitude: currentPoint.longitude } as NavCoordinate
            );
            setBearingToCheckpoint(bearing);
            
            // Check if driver is within 500m of checkpoint
            const distance = calculateDistance(
              latitude,
              longitude,
              currentPoint.latitude,
              currentPoint.longitude
            );
            
            // Show proximity notification if within 500m and not already shown for this checkpoint
            if (distance <= 500 && hasShownProximityNotification.current !== currentPointIndex) {
              hasShownProximityNotification.current = currentPointIndex;
              Toast.show(`You've reached ${currentPoint.name}! Please press "Reached".`, {
                type: "success",
                duration: 5000,
              });
            }
          }
        }
        
        previousLocation.current = { latitude, longitude };
        
        // Update map region with smooth following
        if (isNavigationMode && navigationState.isActive) {
          // Use navigation hook's current location if available
          const navLocation = navigationState.currentLocation || {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          const navHeading = navigationState.driverHeading || driverHeading;
          
          if (navigationDestination) {
            animateCameraToDriver(
              mapRef.current!,
              navLocation,
              navigationDestination,
              navHeading,
              true // navigation mode
            );
          }
        } else if (isNavigationMode) {
          updateMapRegionWithNavigation(location);
        } else {
          updateMapRegion();
        }
      }
    );
  };

  const updateDistanceAndETA = (location: Location.LocationObject) => {
    if (!trip || !location) return;

    const currentPointIndex = trip.progress?.currentPointIndex || 0;
    const currentPoint = trip.points[currentPointIndex];
    
    if (!currentPoint || currentPoint.reachedAt) return;

    // Use navigation state if available, otherwise calculate manually
    if (isNavigationMode && navigationState.isActive && navigationState.distanceToDestination) {
      setDistanceToCheckpoint(navigationState.distanceToDestination);
      setEtaToCheckpoint(navigationState.etaToDestination);
    } else {
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        currentPoint.latitude,
        currentPoint.longitude
      );

      setDistanceToCheckpoint(distance / 1000); // Convert to km

      // Estimate ETA (assuming average speed of 30 km/h in city)
      const estimatedSpeed = 30; // km/h
      const etaMinutes = (distance / 1000 / estimatedSpeed) * 60;
      setEtaToCheckpoint(etaMinutes);
    }
  };

  const updateMapRegion = (tripData?: ScheduledTrip) => {
    const tripDataToUse = tripData || trip;
    if (!tripDataToUse || !tripDataToUse.points || tripDataToUse.points.length === 0 || !currentLocation || !mapRef.current) {
      return;
    }
    
    const currentPoint = tripDataToUse.points[tripDataToUse.progress?.currentPointIndex || 0];
    if (!currentPoint) return;

    const latDelta = Math.abs(currentPoint.latitude - currentLocation.coords.latitude) * 2.5;
    const lngDelta = Math.abs(currentPoint.longitude - currentLocation.coords.longitude) * 2.5;

    mapRef.current.animateToRegion({
      latitude: (currentPoint.latitude + currentLocation.coords.latitude) / 2,
      longitude: (currentPoint.longitude + currentLocation.coords.longitude) / 2,
      latitudeDelta: Math.max(latDelta, 0.05),
      longitudeDelta: Math.max(lngDelta, 0.05),
    }, 1000);
  };

  const updateMapRegionWithNavigation = (location: Location.LocationObject) => {
    if (!trip || !mapRef.current) return;
    
    const currentPointIndex = trip.progress?.currentPointIndex || 0;
    const currentPoint = trip.points[currentPointIndex];
    if (!currentPoint || currentPoint.reachedAt) return;

    const driverLocation: Coordinate = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    const destination: Coordinate = {
      latitude: currentPoint.latitude,
      longitude: currentPoint.longitude,
    };

    animateCameraToDriver(
      mapRef.current,
      driverLocation,
      destination,
      driverHeading,
      true // navigation mode
    );
  };

  const startFullScreenNavigation = () => {
    if (!currentLocation || !trip) {
      Toast.show("Location data not available", { type: "warning" });
      return;
    }

    const currentPointIndex = trip.progress?.currentPointIndex || 0;
    const currentPoint = trip.points[currentPointIndex];
    if (!currentPoint || currentPoint.reachedAt) {
      Toast.show("No active checkpoint to navigate to", { type: "warning" });
      return;
    }

    setIsFullScreenNavigation(true);
  };

  const stopFullScreenNavigation = () => {
    setIsFullScreenNavigation(false);
  };

  useEffect(() => {
    return () => {
      if (locationWatchSubscription.current) {
        locationWatchSubscription.current.remove();
      }
    };
  }, []);

  const handleReachCheckpoint = async (checkpointIndex: number) => {
    if (!trip || !currentLocation) {
      return;
    }

    const checkpoint = trip.points[checkpointIndex];
    if (!checkpoint) {
      return;
    }

    Alert.alert(
      "Reach Checkpoint",
      `Have you reached "${checkpoint.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, I'm here",
          onPress: async () => {
            try {
              setUpdatingProgress(true);
              const accessToken = await AsyncStorage.getItem("accessToken");
              if (!accessToken) {
                Toast.show("Please login first", { type: "danger" });
                return;
              }

              const response = await axios.post(
                `${getServerUri()}/driver/trip/progress`,
                {
                  tripId: trip.id,
                  checkpointIndex,
                  latitude: currentLocation.coords.latitude,
                  longitude: currentLocation.coords.longitude,
                },
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );

              if (response.data.success) {
                Toast.show(
                  checkpoint.isFinalPoint
                    ? "Trip completed successfully!"
                    : "Checkpoint reached!",
                  { type: "success" }
                );

                if (checkpoint.isFinalPoint) {
                  // Trip completed, go back to scheduled trips
                  setTimeout(() => {
                    router.push("/(tabs)/home");
                  }, 2000);
                } else {
                  // Refresh trip data
                  // Reset proximity notification flag when moving to next checkpoint
                  hasShownProximityNotification.current = null;
                  // Reset navigation when checkpoint changes
                  if (isNavigationMode) {
                    stopNavigation();
                  }
                  fetchTrip();
                }
              }
            } catch (error: any) {
              console.error("Error updating progress:", error);
              Toast.show(
                error.response?.data?.message || "Failed to update progress",
                { type: "danger" }
              );
            } finally {
              setUpdatingProgress(false);
            }
          },
        },
      ]
    );
  };

  const handleEmergencyTerminate = async () => {
    if (!trip) {
      return;
    }

    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        Toast.show("Please login first", { type: "danger" });
        return;
      }

      const response = await axios.post(
        `${getServerUri()}/driver/emergency-terminate-trip`,
        {
          tripId: trip.id,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        Toast.show("Trip emergency terminated successfully", {
          type: "success",
        });
        // Update local state
        setCanUseEmergency(false);
        setEmergencyDisabledMessage(
          "You have already used the emergency end option today."
        );
        // Navigate back to home
        setTimeout(() => {
          router.push("/(tabs)/home");
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error emergency terminating trip:", error);
      Toast.show(
        error.response?.data?.message || "Failed to emergency terminate trip",
        { type: "danger" }
      );
      throw error; // Re-throw to let the slider handle the error state
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={color.primary} />
        <Text style={{ marginTop: 10, color: colors.text }}>Loading trip...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.text }}>Trip not found</Text>
      </View>
    );
  }

  const currentPointIndex = trip.progress?.currentPointIndex || 0;
  const currentPoint = trip.points[currentPointIndex];
  const isCompleted = trip.status === "COMPLETED";

  // Calculate if driver is within 500m of the current checkpoint
  const isWithinRange = (checkpointIndex: number): boolean => {
    if (!currentLocation || !trip) {
      return false;
    }

    const checkpoint = trip.points[checkpointIndex];
    if (!checkpoint) {
      return false;
    }

    const distance = calculateDistance(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      checkpoint.latitude,
      checkpoint.longitude
    );

    return distance <= 500; // 500 meters
  };

  // Get origin and destination for full-screen navigation
  const getNavigationOrigin = (): Coordinate | null => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  };

  const getNavigationDestination = (): Coordinate | null => {
    if (!trip || !currentPoint || currentPoint.reachedAt) return null;
    return {
      latitude: currentPoint.latitude,
      longitude: currentPoint.longitude,
    };
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Full-Screen Navigation Modal */}
      {isFullScreenNavigation && getNavigationOrigin() && getNavigationDestination() && (
        <Modal
          visible={isFullScreenNavigation}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <NavigationScreen
            origin={getNavigationOrigin()!}
            destination={getNavigationDestination()!}
            mode="destination"
            onClose={stopFullScreenNavigation}
            onArrival={() => {
              Toast.show("Arrived at checkpoint!", { type: "success" });
              setIsFullScreenNavigation(false);
            }}
          />
        </Modal>
      )}

      {/* Map View */}
      <View style={{ height: windowHeight(400), position: "relative" }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: currentPoint?.latitude || 0,
            longitude: currentPoint?.longitude || 0,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
          followsUserLocation={false}
          rotateEnabled={isNavigationMode && navigationState.isActive}
          pitchEnabled={isNavigationMode && navigationState.isActive}
          scrollEnabled={!(isNavigationMode && navigationState.isActive)}
          zoomEnabled={!(isNavigationMode && navigationState.isActive)}
        >
          {/* Current Location - Using showsUserLocation instead */}

          {/* Checkpoints */}
          {trip.points.map((point, index) => {
            const isReached = point.reachedAt !== null;
            const isCurrent = index === currentPointIndex && !isReached;
            const isPast = index < currentPointIndex;

            return (
              <Marker
                key={point.id}
                coordinate={{
                  latitude: point.latitude,
                  longitude: point.longitude,
                }}
                title={point.name}
                description={isReached ? "Reached" : isCurrent ? "Current" : "Upcoming"}
                pinColor={
                  isReached ? "green" : isCurrent ? "red" : isPast ? "gray" : "orange"
                }
              />
            );
          })}

          {/* Route to current checkpoint */}
          {currentLocation && currentPoint && !currentPoint.reachedAt && (
            <>
              {/* Use navigation hook route if available, otherwise fallback to MapViewDirections */}
              {isNavigationMode && navigationState.isActive && navigationState.route ? (
                <Polyline
                  coordinates={decodePolyline(navigationState.route.overview_polyline.points)}
                  strokeColor={color.primary}
                  strokeWidth={5}
                  lineCap="round"
                  lineJoin="round"
                />
              ) : (
                <MapViewDirections
                  origin={{
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                  }}
                  destination={{
                    latitude: currentPoint.latitude,
                    longitude: currentPoint.longitude,
                  }}
                  apikey={process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY!}
                  strokeWidth={4}
                  strokeColor={color.primary}
                  onReady={(result) => {
                    // Update distance and ETA when route is calculated
                    if (result.distance && result.duration) {
                      setDistanceToCheckpoint(result.distance / 1000); // Convert to km
                      setEtaToCheckpoint(result.duration / 60); // Convert to minutes
                    }
                  }}
                />
              )}
            </>
          )}
        </MapView>
        
        {/* Turn-by-Turn Instructions Overlay */}
        {isNavigationMode && navigationState.isActive && navigationState.nextTurn && (
          <TurnByTurnCard
            step={navigationState.nextTurn.step}
            distanceToTurn={navigationState.nextTurn.distanceToTurn}
            visible={true}
          />
        )}
        
        {/* Navigation Arrow */}
        {isNavigationMode && navigationState.isActive ? (
          navigationState.bearingToDestination !== null && (
            <NavigationArrow
              bearingToDestination={navigationState.bearingToDestination}
              driverHeading={navigationState.driverHeading || driverHeading}
              size={70}
              color={color.status.active}
              visible={true}
            />
          )
        ) : (
          bearingToCheckpoint !== null && 
          currentLocation && 
          currentPoint && 
          !currentPoint.reachedAt && (
            <NavigationArrow
              bearingToDestination={bearingToCheckpoint}
              driverHeading={driverHeading}
              size={70}
              color={color.status.active}
              visible={true}
            />
          )
        )}
        
        {/* ETA and Distance Overlay - Bottom of Map */}
        {isNavigationMode && navigationState.isActive && currentPoint && !currentPoint.reachedAt && (
          <View
            style={{
              position: "absolute",
              bottom: spacing.xl + 50, // Above the control buttons
              left: spacing.md,
              right: spacing.md,
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: spacing.md,
              ...shadows.lg,
              zIndex: 999,
            }}
          >
            <Text
              style={{
                fontSize: fontSizes.FONT12,
                fontFamily: fonts.medium,
                color: color.text.secondary,
                marginBottom: spacing.xs,
              }}
            >
              To {currentPoint.name}
            </Text>
            <ETADisplay
              distance={navigationState.distanceToDestination}
              duration={navigationState.etaToDestination}
              size="md"
            />
          </View>
        )}
        
        {/* Loading Overlay for Route Calculation */}
        {isNavigationMode && navigationState.isLoading && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 2000,
            }}
          >
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: spacing.lg,
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={color.primary} />
              <Text
                style={{
                  marginTop: spacing.md,
                  fontSize: fontSizes.FONT14,
                  fontFamily: fonts.medium,
                  color: colors.text,
                }}
              >
                Calculating route...
              </Text>
            </View>
          </View>
        )}
        
        {/* Error Message */}
        {isNavigationMode && navigationState.error && (
          <View
            style={{
              position: "absolute",
              top: spacing.xl + 60,
              left: spacing.md,
              right: spacing.md,
              backgroundColor: color.semantic.errorLight,
              padding: spacing.md,
              borderRadius: 8,
              zIndex: 2000,
            }}
          >
            <Text
              style={{
                fontSize: fontSizes.FONT14,
                fontFamily: fonts.medium,
                color: color.semantic.error,
                textAlign: "center",
              }}
            >
              {navigationState.error}
            </Text>
          </View>
        )}
        
        {/* Map Control Buttons */}
        <View style={{ position: "absolute", bottom: spacing.md, right: spacing.md, gap: spacing.sm }}>
          {/* Center on me button */}
          {currentLocation && (
            <TouchableOpacity
              style={{
                backgroundColor: "#fff",
                width: 44,
                height: 44,
                borderRadius: 22,
                justifyContent: "center",
                alignItems: "center",
                ...shadows.md,
              }}
              onPress={() => {
                if (isNavigationMode && navigationState.isActive && navigationState.currentLocation && navigationDestination) {
                  animateCameraToDriver(
                    mapRef.current!,
                    navigationState.currentLocation,
                    navigationDestination,
                    navigationState.driverHeading || driverHeading,
                    true
                  );
                } else if (isNavigationMode && currentLocation && trip) {
                  updateMapRegionWithNavigation(currentLocation);
                } else {
                  updateMapRegion();
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>📍</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Trip Info and Checkpoints */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
      >
        {/* Trip Header with Progress */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ fontSize: fontSizes.FONT24, fontWeight: "bold", color: colors.text, marginBottom: spacing.xs }}>
            {trip.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
            {trip.company?.name && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: color.primary,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs / 2,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    color: color.primary,
                    fontSize: fontSizes.FONT12,
                    fontFamily: fonts.medium,
                  }}
                >
                  {trip.company.name}
                </Text>
              </View>
            )}
            {typeof trip.price === "number" && (
              <Text
                style={{
                  color: color.secondaryFont,
                  fontSize: fontSizes.FONT12,
                  fontFamily: fonts.medium,
                }}
              >
                ${trip.price.toFixed(2)}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: fontSizes.FONT14, fontFamily: fonts.regular }}>
              Progress: {currentPointIndex + 1} of {trip.points.length} checkpoints
            </Text>
            {/* Progress Bar */}
            <View style={{ flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, marginLeft: spacing.md }}>
              <View
                style={{
                  width: `${((currentPointIndex + 1) / trip.points.length) * 100}%`,
                  height: "100%",
                  backgroundColor: color.status.completed,
                  borderRadius: 3,
                }}
              />
            </View>
          </View>
        </View>

        {/* Current Checkpoint ETA */}
        {currentPoint && !currentPoint.reachedAt && (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: spacing.lg,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: color.status.active,
            }}
          >
            <Text style={{ fontSize: fontSizes.FONT14, fontFamily: fonts.medium, color: color.text.secondary, marginBottom: spacing.sm }}>
              Next Checkpoint
            </Text>
            <Text style={{ fontSize: fontSizes.FONT18, fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.md }}>
              {currentPoint.name}
            </Text>
            <ETADisplay distance={distanceToCheckpoint} duration={etaToCheckpoint} size="md" />
          </View>
        )}

        {/* Checkpoints List */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ fontSize: fontSizes.FONT18, fontWeight: "600", color: colors.text, marginBottom: spacing.md, fontFamily: fonts.bold }}>
            All Checkpoints
          </Text>
          {trip.points.map((point, index) => {
            const isReached = point.reachedAt !== null;
            const isCurrent = index === currentPointIndex && !isReached;
            const isPast = index < currentPointIndex;

            return (
              <CheckpointCard
                key={point.id}
                checkpoint={point}
                isCurrent={isCurrent}
                isReached={isReached}
                isPast={isPast}
                distance={isCurrent ? distanceToCheckpoint : undefined}
                duration={isCurrent ? etaToCheckpoint : undefined}
                onReachPress={() => handleReachCheckpoint(index)}
                disabled={updatingProgress || !isWithinRange(index)}
                showReachButton={isCurrent && !isCompleted}
              />
            );
          })}
        </View>

        {isCompleted && (
          <View
            style={{
              backgroundColor: "#10b98120",
              padding: 16,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#10b981", fontSize: 16, fontWeight: "600" }}>
              ✓ Trip Completed!
            </Text>
          </View>
        )}

        {/* Emergency End Trip Slider - Only show for ACTIVE trips */}
        {!isCompleted && trip.status === "ACTIVE" && (
          <EmergencyEndSlider
            onConfirm={handleEmergencyTerminate}
            disabled={!canUseEmergency}
            disabledMessage={emergencyDisabledMessage}
          />
        )}
      </ScrollView>
    </View>
  );
}

