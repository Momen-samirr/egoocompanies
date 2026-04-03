import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { windowHeight, fontSizes } from "@/themes/app.constant";
import { Toast } from "react-native-toast-notifications";
import { useGetDriverData } from "@/hooks/useGetDriverData";
import { getServerUri } from "@/configs/constants";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import color from "@/themes/app.colors";
import { calculateDistance } from "@/utils/haversine";
import EmergencyEndSlider from "@/components/trip/EmergencyEndSlider";
import EmployeeBottomSheet from "@/components/trip/EmployeeBottomSheet";
import { spacing, shadows } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import NavigationArrow from "@/components/navigation/NavigationArrow";
import {
  calculateBearing,
  calculateHeadingFromMovement,
  Coordinate as NavCoordinate,
} from "@/utils/navigation.utils";
import { Coordinate } from "@/services/navigationService";
import { animateCameraToDriver } from "@/utils/mapCamera";
import { useNavigation } from "@/hooks/useNavigation";
import TurnByTurnCard from "@/components/navigation/TurnByTurnCard";
import { decodePolyline } from "@/services/navigationService";
import { useKeepAwake } from "@/hooks/useKeepAwake";
import { useThrottledCoordinates } from "@/hooks/useThrottledCoordinates";
import DraggableBottomSheet from "@/components/common/DraggableBottomSheet";
import {
  getRoadRouteMetrics,
  resolveClosestUpcomingStop,
} from "@/services/routeMetricsService";
import { useTripActivation } from "@/contexts/TripActivationContext";

interface ScheduledTrip {
  id: string;
  name: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "FORCE_CLOSED";
  tripType?: "ARRIVAL" | "DEPARTURE";
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
    expectedTime?: string | null;
    reachedAt: string | null;
    employees?: Array<{ name: string; employeeId?: string }>;
  }>;
  progress: {
    currentPointIndex: number;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
}

export default function TripNavigationScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation("trips");
  const { t: tc } = useTranslation("common");
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { driver } = useGetDriverData();
  const { markTripActive, clearActiveTrip } = useTripActivation();
  const [trip, setTrip] = useState<ScheduledTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [distanceToCheckpoint, setDistanceToCheckpoint] = useState<
    number | undefined
  >(undefined);
  const [etaToCheckpoint, setEtaToCheckpoint] = useState<number | undefined>(
    undefined
  );
  const [nextStopIndex, setNextStopIndex] = useState<number | null>(null);
  const [canUseEmergency, setCanUseEmergency] = useState(true);
  const [emergencyDisabledMessage, setEmergencyDisabledMessage] =
    useState<string>("");
  const [isEmployeeSheetVisible, setIsEmployeeSheetVisible] = useState(false);
  const mapRef = useRef<MapView>(null);
  const locationWatchSubscription =
    useRef<Location.LocationSubscription | null>(null);

  // Navigation state
  const [driverHeading, setDriverHeading] = useState<number | null>(null);
  const [bearingToCheckpoint, setBearingToCheckpoint] = useState<number | null>(
    null
  );
  const [isNavigationMode] = useState(true);
  const previousLocation = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const hasShownProximityNotification = useRef<number | null>(null);
  const mapInitializedRef = useRef(false);
  const roadMetricsRequestIdRef = useRef(0);
  const lastRoadMetricsAtRef = useRef(0);
  const lastRoadMetricsOriginRef = useRef<Coordinate | null>(null);

  // Navigation hook state
  const [navigationOrigin, setNavigationOrigin] = useState<Coordinate | null>(
    null
  );
  const [navigationDestination, setNavigationDestination] =
    useState<Coordinate | null>(null);

  // Track if we've manually started navigation to avoid conflicts
  const hasManuallyStartedNavigation = useRef(false);
  const navigationStartRequested = useRef(false);

  const onNavigationArrival = useCallback(() => {
    Toast.show(t("arrivedCheckpoint"), { type: "success" });
  }, [t]);

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
    onArrival: onNavigationArrival,
    onDeviation: () => {
      console.log("⚠️ Route deviation detected, recalculating...");
    },
  });

  // Keep screen awake during active trips
  const shouldKeepAwake = trip?.status === "ACTIVE";
  useKeepAwake(shouldKeepAwake);

  // Throttle coordinates for MapViewDirections to reduce API calls
  // Only update when location moves >100m or 60 seconds have passed
  const throttledOrigin = useThrottledCoordinates(
    currentLocation?.coords ? {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    } : null,
    100, // 100 meters threshold
    60000 // 60 seconds threshold
  );

  // Memoized MapViewDirections for fallback route display
  const memoizedDirections = useMemo(() => {
    if (!throttledOrigin || !trip) {
      return null;
    }

    const currentPointIndex = trip.progress?.currentPointIndex || 0;
    const effectiveIndex = nextStopIndex ?? currentPointIndex;
    const currentPoint = trip.points[effectiveIndex];

    if (!currentPoint || currentPoint.reachedAt) {
      return null;
    }

    return (
      <MapViewDirections
        origin={throttledOrigin}
        destination={{
          latitude: currentPoint.latitude,
          longitude: currentPoint.longitude,
        }}
        apikey={process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY!}
        strokeWidth={5}
        strokeColor={color.primary}
        lineCap="round"
        lineJoin="round"
        onReady={(result) => {
          // MapViewDirections is used for route visualization only
          // Distance/ETA should be calculated from driver's current location, not throttled origin
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'trip-navigation.screen.tsx:182',message:'MapViewDirections onReady',data:{hasDistance:!!result.distance,hasDuration:!!result.duration,distance:result.distance,duration:result.duration,throttledOriginLat:throttledOrigin?.latitude,throttledOriginLng:throttledOrigin?.longitude,currentLocationLat:currentLocation?.coords?.latitude,currentLocationLng:currentLocation?.coords?.longitude,isNavigationMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          // Don't use MapViewDirections results for distance/ETA calculation
          // because it uses throttled coordinates which may be stale.
          // Instead, rely on updateDistanceAndETA which uses current location.
          // Only use as fallback if we don't have current location yet AND distance is reasonable
          if (result.distance && result.duration && !isNavigationMode && !currentLocation) {
            const distanceKm = result.distance / 1000;
            // Only use if distance is reasonable (not suspiciously small)
            if (distanceKm >= 0.01) { // At least 10 meters
              // No current location yet, use MapViewDirections result as temporary fallback
              setDistanceToCheckpoint(distanceKm);
              setEtaToCheckpoint(result.duration / 60); // Convert to minutes
            }
          }
          // If we have current location, immediately recalculate with it to override any stale values
          if (currentLocation) {
            updateDistanceAndETA(currentLocation);
          }
        }}
        onError={(errorMessage) => {
          console.error("MapViewDirections error:", errorMessage);
        }}
      />
    );
  }, [throttledOrigin, trip, nextStopIndex, isNavigationMode, currentLocation]);

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
  }, [
    navigationOrigin?.latitude,
    navigationOrigin?.longitude,
    navigationDestination?.latitude,
    navigationDestination?.longitude,
  ]);

  useEffect(() => {
    if (tripId) {
      // Store active trip ID for location tracking
      markTripActive(tripId).catch((error) => {
        console.error("Error storing active trip ID:", error);
      });

      fetchTrip();
      startLocationTracking();
      checkEmergencyUsageStatus();
    }

  }, [tripId, markTripActive]);

  useEffect(() => {
    if (!tripId) return;
    const refreshInterval = setInterval(() => {
      fetchTrip();
    }, 20000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [tripId]);

  // Clear active trip ID when trip is completed, cancelled, or force closed
  useEffect(() => {
    if (
      trip &&
      (trip.status === "COMPLETED" ||
        trip.status === "CANCELLED" ||
        trip.status === "FORCE_CLOSED")
    ) {
      clearActiveTrip().catch((error) => {
        console.error("Error removing active trip ID:", error);
      });
    }
  }, [trip?.status, clearActiveTrip]);

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

  // Update navigation destination when next stop changes
  useEffect(() => {
    if (!trip) return;
    const progressIndex = trip.progress?.currentPointIndex || 0;
    const effectiveIndex = nextStopIndex ?? progressIndex;
    const nextPoint = trip.points[effectiveIndex];

    if (nextPoint && !nextPoint.reachedAt) {
      setNavigationDestination({
        latitude: nextPoint.latitude,
        longitude: nextPoint.longitude,
      });
    } else {
      setNavigationDestination(null);
    }
  }, [trip, nextStopIndex]);

  // Ensure map region is updated when both trip and location are available
  useEffect(() => {
    if (
      trip &&
      currentLocation &&
      mapRef.current &&
      !mapInitializedRef.current
    ) {
      const currentPointIndex = trip.progress?.currentPointIndex || 0;
      const currentPoint = trip.points[currentPointIndex];

      if (currentPoint) {
        updateMapRegion(trip);
        updateDistanceAndETA(currentLocation);
        mapInitializedRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, currentLocation]);

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

  const fetchTrip = useCallback(async () => {
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        Toast.show(t("loginFirst"), { type: "danger" });
        return;
      }

      const response = await axios.get(
        `${getServerUri()}/driver/scheduled-trips`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        const activeTrip = response.data.trips.find(
          (tripItem: ScheduledTrip) => tripItem.id === tripId
        );
        if (activeTrip) {
          // Check if trip has been force closed
          if (activeTrip.status === "FORCE_CLOSED") {
            // Clear active trip ID
            await clearActiveTrip();

            Toast.show(t("forceClosed"), {
              type: "danger",
              duration: 5000,
            });
            setTimeout(() => {
              router.back();
            }, 2000);
            return;
          }

          // Reset proximity notification flag when trip data changes
          const newCurrentPointIndex =
            activeTrip.progress?.currentPointIndex || 0;
          if (hasShownProximityNotification.current !== newCurrentPointIndex) {
            hasShownProximityNotification.current = null;
          }
          setNextStopIndex(newCurrentPointIndex);
          setTrip(activeTrip);
        } else {
          Toast.show(t("tripNotActive"), { type: "danger" });
          router.back();
        }
      }
    } catch (error: any) {
      console.error("Error fetching trip:", error);
      Toast.show(error.response?.data?.message || t("fetchTripFailed"), {
        type: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [tripId, t, clearActiveTrip]);

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Toast.show(t("locationRequired"), { type: "danger" });
      return;
    }

    // Get initial location
    const location = await Location.getCurrentPositionAsync({});
    setCurrentLocation(location);
    // Immediately calculate distance/ETA with current location
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'trip-navigation.screen.tsx:428',message:'Location update received',data:{lat:location.coords.latitude,lng:location.coords.longitude,heading:location.coords.heading,accuracy:location.coords.accuracy,timestamp:location.timestamp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
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
              {
                latitude: currentPoint.latitude,
                longitude: currentPoint.longitude,
              } as NavCoordinate
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
            if (
              distance <= 500 &&
              hasShownProximityNotification.current !== currentPointIndex
            ) {
              hasShownProximityNotification.current = currentPointIndex;
              Toast.show(
                t("proximityPressReached", {
                  name: currentPoint.name,
                  action: t("reachedLabel"),
                }),
                {
                  type: "success",
                  duration: 5000,
                }
              );
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

  const updateDistanceAndETA = async (location: Location.LocationObject) => {
    if (!trip || !location) return;

    const driverCoordinate: Coordinate = {
      latitude: Number(location.coords.latitude),
      longitude: Number(location.coords.longitude),
    };
    const progressIndex = trip.progress?.currentPointIndex || 0;
    const nextStop = resolveClosestUpcomingStop(
      trip.points,
      driverCoordinate,
      progressIndex
    );

    if (!nextStop) {
      setDistanceToCheckpoint(undefined);
      setEtaToCheckpoint(undefined);
      return;
    }

    setNextStopIndex(nextStop.stopIndex);

    const destinationCoordinate: Coordinate = {
      latitude: Number(nextStop.stop.latitude),
      longitude: Number(nextStop.stop.longitude),
    };

    const calculatedBearing = calculateBearing(
      driverCoordinate as NavCoordinate,
      destinationCoordinate as NavCoordinate
    );
    setBearingToCheckpoint(calculatedBearing);

    const now = Date.now();
    const movedMeters = lastRoadMetricsOriginRef.current
      ? calculateDistance(
          lastRoadMetricsOriginRef.current.latitude,
          lastRoadMetricsOriginRef.current.longitude,
          driverCoordinate.latitude,
          driverCoordinate.longitude
        )
      : Number.POSITIVE_INFINITY;

    const shouldRefreshRoadMetrics =
      !lastRoadMetricsOriginRef.current ||
      movedMeters >= 35 ||
      now - lastRoadMetricsAtRef.current >= 12000;

    if (!shouldRefreshRoadMetrics && distanceToCheckpoint !== undefined) {
      return;
    }

    const requestId = ++roadMetricsRequestIdRef.current;
    const metrics = await getRoadRouteMetrics(driverCoordinate, destinationCoordinate);

    if (requestId !== roadMetricsRequestIdRef.current) {
      return;
    }

    setDistanceToCheckpoint(metrics.distanceKm);
    setEtaToCheckpoint(metrics.durationMin);
    lastRoadMetricsAtRef.current = now;
    lastRoadMetricsOriginRef.current = driverCoordinate;

    console.log("📍 Next stop metrics", {
      stopName: nextStop.stop.name,
      stopIndex: nextStop.stopIndex,
      coordsUsed: {
        driver: driverCoordinate,
        stop: destinationCoordinate,
      },
      straightLineKm: Number(nextStop.straightLineDistanceKm.toFixed(3)),
      apiDistanceKm: Number(metrics.distanceKm.toFixed(3)),
      apiDurationMin: Number(metrics.durationMin.toFixed(2)),
      source: metrics.source,
    });

    if (metrics.source === "fallback") {
      console.warn(
        "⚠️ Using fallback ETA metrics (road route unavailable).",
        {
          stop: nextStop.stop.name,
          driver: driverCoordinate,
          destination: destinationCoordinate,
        }
      );
    }
  };

  const updateMapRegion = (tripData?: ScheduledTrip) => {
    const tripDataToUse = tripData || trip;
    if (
      !tripDataToUse ||
      !tripDataToUse.points ||
      tripDataToUse.points.length === 0 ||
      !currentLocation ||
      !mapRef.current
    ) {
      return;
    }

    const progressIndex = tripDataToUse.progress?.currentPointIndex || 0;
    const effectiveIndex = nextStopIndex ?? progressIndex;
    const currentPoint = tripDataToUse.points[effectiveIndex];
    if (!currentPoint || currentPoint.reachedAt) return;

    const latDelta =
      Math.abs(currentPoint.latitude - currentLocation.coords.latitude) * 2.5;
    const lngDelta =
      Math.abs(currentPoint.longitude - currentLocation.coords.longitude) * 2.5;

    mapRef.current.animateToRegion(
      {
        latitude: (currentPoint.latitude + currentLocation.coords.latitude) / 2,
        longitude:
          (currentPoint.longitude + currentLocation.coords.longitude) / 2,
        latitudeDelta: Math.max(latDelta, 0.05),
        longitudeDelta: Math.max(lngDelta, 0.05),
      },
      1000
    );
  };

  const updateMapRegionWithNavigation = (location: Location.LocationObject) => {
    if (!trip || !mapRef.current) return;

    const progressIndex = trip.progress?.currentPointIndex || 0;
    const effectiveIndex = nextStopIndex ?? progressIndex;
    const currentPoint = trip.points[effectiveIndex];
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
      t("reachCheckpointTitle"),
      t("reachCheckpointMessage", { name: checkpoint.name }),
      [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("yesImHere"),
        onPress: async () => {
          try {
            setUpdatingProgress(true);
            const accessToken = await AsyncStorage.getItem("accessToken");
            if (!accessToken) {
              Toast.show(t("loginFirst"), { type: "danger" });
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
              // Show timing message for ARRIVAL trips
              if (trip.tripType === "ARRIVAL" && response.data.timing) {
                const timing = response.data.timing;
                let timingMessage = "";

                if (timing.status === "on-time") {
                  timingMessage = t("timingOnTime");
                } else if (timing.status === "early") {
                  const unit =
                    timing.minutes === 1
                      ? t("minuteSingular")
                      : t("minutePlural");
                  timingMessage = t("timingEarly", {
                    minutes: timing.minutes,
                    unit,
                  });
                } else if (timing.status === "late") {
                  const unit =
                    timing.minutes === 1
                      ? t("minuteSingular")
                      : t("minutePlural");
                  timingMessage = t("timingLate", {
                    minutes: timing.minutes,
                    unit,
                  });
                }

                if (timingMessage) {
                  Toast.show(timingMessage, {
                    type: timing.status === "late" ? "warning" : "success",
                    duration: 5000,
                  });
                }
              } else {
                // Default success message
                Toast.show(
                  checkpoint.isFinalPoint
                    ? t("tripCompletedSuccessfully")
                    : t("checkpointReachedToast"),
                  { type: "success" }
                );
              }

              if (checkpoint.isFinalPoint) {
                // Trip completed, clear active trip ID
                await clearActiveTrip();
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
              error.response?.data?.message || t("updateProgressFailed"),
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
        Toast.show(t("loginFirst"), { type: "danger" });
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
        // Clear active trip ID
        await clearActiveTrip();

        Toast.show(t("emergencySuccess"), {
          type: "success",
        });
        // Update local state
        setCanUseEmergency(false);
        setEmergencyDisabledMessage(t("emergencyUsedToday"));
        // Navigate back to home
        setTimeout(() => {
          router.push("/(tabs)/home");
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error emergency terminating trip:", error);
      Toast.show(
        error.response?.data?.message || t("failedEmergencyTerminate"),
        { type: "danger" }
      );
      throw error; // Re-throw to let the slider handle the error state
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={color.primary} />
        <Text style={{ marginTop: 10, color: colors.text }}>
          {t("loadingTrip")}
        </Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.text }}>{t("tripNotFound")}</Text>
      </View>
    );
  }

  const currentPointIndex = trip.progress?.currentPointIndex || 0;
  const currentPoint = trip.points[currentPointIndex];
  const effectiveNextStopIndex = nextStopIndex ?? currentPointIndex;
  const nextStopPoint = trip.points[effectiveNextStopIndex] || currentPoint;
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

  // Calculate safe initial region coordinates
  const getInitialRegion = () => {
    // Use current point if available
    if (trip && trip.points && trip.points.length > 0) {
      const progressIndex = trip.progress?.currentPointIndex || 0;
      const effectiveIndex = nextStopIndex ?? progressIndex;
      const currentPoint = trip.points[effectiveIndex] || trip.points[progressIndex];
      if (currentPoint) {
        return {
          latitude: currentPoint.latitude,
          longitude: currentPoint.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
      }
    }

    // Fallback to current location if available
    if (currentLocation) {
      return {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Last resort: use a safe default location instead of 0,0
    return {
      latitude: 30.0444, // Cairo, Egypt (adjust to your app's primary region)
      longitude: 31.2357,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  };

  const formatClockTime = (rawTime?: string | null): string => {
    if (!rawTime) return "--:--";
    const parsed = new Date(rawTime);
    if (Number.isNaN(parsed.getTime())) return "--:--";
    return parsed.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const tripShortId = `#${trip.id.slice(0, 6).toUpperCase()}`;
  const remainingStops = trip.points.filter((point) => !point.reachedAt).length;
  const currentCheckpointEmployees = currentPoint?.employees?.length || 0;
  const nextStopDistanceLabel =
    distanceToCheckpoint && distanceToCheckpoint > 0
      ? t("kmAway", { distance: distanceToCheckpoint.toFixed(1) })
      : t("distanceUnavailableNav");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={getInitialRegion()}
          showsUserLocation={true}
          followsUserLocation={false}
          rotateEnabled={isNavigationMode && navigationState.isActive}
          pitchEnabled={isNavigationMode && navigationState.isActive}
          scrollEnabled={!(isNavigationMode && navigationState.isActive)}
          zoomEnabled={!(isNavigationMode && navigationState.isActive)}
        >
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
                description={
                  isReached
                    ? t("reachedLabel")
                    : isCurrent
                      ? t("currentLabel")
                      : t("upcomingLabel")
                }
                pinColor={
                  isReached ? "#10b981" : isCurrent ? color.primary : isPast ? "#9ca3af" : "#f59e0b"
                }
              />
            );
          })}

          {currentLocation && nextStopPoint && !nextStopPoint.reachedAt && (
            <>
              {isNavigationMode &&
              navigationState.isActive &&
              navigationState.route ? (
                <Polyline
                  coordinates={decodePolyline(
                    navigationState.route.overview_polyline.points
                  )}
                  strokeColor={color.primary}
                  strokeWidth={6}
                  lineCap="round"
                  lineJoin="round"
                />
              ) : (
                memoizedDirections
              )}
            </>
          )}
        </MapView>

        <View
          style={{
            position: "absolute",
            top: windowHeight(52),
            start: spacing.lg,
            end: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.94)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: color.primary, fontSize: 18 }}>☰</Text>
            </View>
            <Text style={{ color: color.primary, fontFamily: fonts.bold, fontSize: fontSizes.FONT30 }}>
              {tc("transportHub")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() =>
                !isCompleted &&
                trip.status === "ACTIVE" &&
                Alert.alert(
                  t("emergencyEndConfirmTitle"),
                  t("emergencyEndConfirmMessage"),
                  [
                    { text: t("cancel"), style: "cancel" },
                    {
                      text: t("confirmEmergencyEnd"),
                      style: "destructive",
                      onPress: () => {
                        handleEmergencyTerminate();
                      },
                    },
                  ]
                )
              }
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#FFE8E8",
                alignItems: "center",
                justifyContent: "center",
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#C81E1E", fontSize: 20 }}>✱</Text>
            </TouchableOpacity>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.94)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.text, fontFamily: fonts.bold }}>
                {driver?.name?.[0] || "D"}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            position: "absolute",
            top: windowHeight(132),
            start: spacing.lg,
            end: spacing.lg,
            backgroundColor: "rgba(255,255,255,0.97)",
            borderRadius: 28,
            padding: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            ...shadows.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 24,
                backgroundColor: color.primary,
                alignItems: "center",
                justifyContent: "center",
                marginEnd: spacing.md,
              }}
            >
              <Text style={{ color: color.whiteColor, fontFamily: fonts.bold, fontSize: 28 }}>
                {etaToCheckpoint ? Math.max(1, Math.round(etaToCheckpoint)) : "--"}
              </Text>
              <Text style={{ color: color.whiteColor, fontFamily: fonts.medium, fontSize: fontSizes.FONT11 }}>
                {t("minUpper")}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: color.text.secondary, fontFamily: fonts.bold, fontSize: fontSizes.FONT12, letterSpacing: 1.4 }}>
                {t("nextStopUpper")}
              </Text>
              <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: fontSizes.FONT34 }} numberOfLines={1}>
                    {nextStopPoint?.name || t("waitingForStop")}
              </Text>
              <Text style={{ color: color.text.secondary, fontFamily: fonts.medium, fontSize: fontSizes.FONT18 }}>
                {nextStopDistanceLabel}
              </Text>
            </View>
          </View>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "#ECECFF",
              alignItems: "center",
              justifyContent: "center",
              marginStart: spacing.sm,
            }}
          >
            <Text style={{ color: color.primary, fontSize: 20 }}>↱</Text>
          </View>
        </View>

        {isNavigationMode &&
          navigationState.isActive &&
          navigationState.nextTurn && (
            <TurnByTurnCard
              step={navigationState.nextTurn.step}
              distanceToTurn={navigationState.nextTurn.distanceToTurn}
              visible={true}
            />
          )}

        {isNavigationMode &&
          navigationState.isActive &&
          navigationState.bearingToDestination !== null && (
            <NavigationArrow
              bearingToDestination={navigationState.bearingToDestination}
              driverHeading={navigationState.driverHeading || driverHeading}
              size={70}
              color={color.status.active}
              visible={true}
            />
          )}

        <TouchableOpacity
          style={{
            position: "absolute",
            bottom: windowHeight(360),
            end: spacing.md,
            backgroundColor: "#fff",
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: "center",
            alignItems: "center",
            ...shadows.md,
          }}
          onPress={() => {
            if (
              navigationState.isActive &&
              navigationState.currentLocation &&
              navigationDestination
            ) {
              animateCameraToDriver(
                mapRef.current!,
                navigationState.currentLocation,
                navigationDestination,
                navigationState.driverHeading || driverHeading,
                true
              );
            } else if (currentLocation && trip) {
              updateMapRegionWithNavigation(currentLocation);
            } else {
              updateMapRegion();
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20 }}>📍</Text>
        </TouchableOpacity>

        <DraggableBottomSheet
          collapsedHeight={windowHeight(220)}
          expandedHeight={windowHeight(740)}
          initialState="collapsed"
          sheetStyle={{
            backgroundColor: "rgba(255,255,255,0.96)",
            ...shadows.md,
          }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
          }}
        >
            <View style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: fontSizes.FONT36 }}>
                  {t("routeProgress")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#EEF0FF",
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ color: color.primary, fontSize: 14, marginRight: 4 }}>●</Text>
                  <Text style={{ color: color.primary, fontFamily: fonts.bold, fontSize: fontSizes.FONT13 }}>
                    {t("liveBadge")}
                  </Text>
                </View>
              </View>
              <Text style={{ marginTop: spacing.xs, color: color.text.secondary, fontFamily: fonts.medium, fontSize: fontSizes.FONT20 }}>
                {t("stopsRemaining", {
                  count: remainingStops,
                  id: tripShortId,
                })}
              </Text>
            </View>

            {trip.points.map((point, index) => {
              const isReached = !!point.reachedAt;
              const isCurrent = index === currentPointIndex && !isReached;
              const hasNext = index < trip.points.length - 1;
              return (
                <View key={point.id} style={{ marginBottom: spacing.md }}>
                  <View style={{ flexDirection: "row" }}>
                    <View style={{ width: 28, alignItems: "center" }}>
                      <View
                        style={{
                          width: isCurrent ? 24 : 18,
                          height: isCurrent ? 24 : 18,
                          borderRadius: 999,
                          backgroundColor: isReached
                            ? "#10b981"
                            : isCurrent
                            ? color.primary
                            : "#E5E7EB",
                          borderWidth: isCurrent ? 5 : 2,
                          borderColor: isCurrent ? "#DDE0FF" : "#D1D5DB",
                          marginTop: 6,
                        }}
                      />
                      {hasNext && (
                        <View
                          style={{
                            width: 2,
                            flex: 1,
                            marginTop: 4,
                            backgroundColor: "#E5E7EB",
                            minHeight: 44,
                          }}
                        />
                      )}
                    </View>

                    {isCurrent ? (
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: color.whiteColor,
                          borderRadius: 24,
                          padding: spacing.lg,
                          borderWidth: 1,
                          borderColor: "#E6E9F0",
                          ...shadows.sm,
                        }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <View style={{ flex: 1, paddingRight: spacing.md }}>
                            <Text style={{ color: color.primary, fontFamily: fonts.bold, fontSize: fontSizes.FONT30 }}>
                              {point.name}
                            </Text>
                            <Text style={{ color: colors.text, fontFamily: fonts.regular, fontSize: fontSizes.FONT30, marginTop: 2 }}>
                              {t("expectedArrival", {
                                time: formatClockTime(point.expectedTime),
                              })}
                            </Text>
                          </View>
                          <View
                            style={{
                              backgroundColor: "#ECECFF",
                              borderRadius: 12,
                              paddingHorizontal: spacing.sm,
                              paddingVertical: spacing.xs,
                            }}
                          >
                            <Text style={{ color: color.primary, fontFamily: fonts.bold, fontSize: fontSizes.FONT12 }}>
                              {t("inProgressBadge")}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
                          <TouchableOpacity
                            onPress={() => setIsEmployeeSheetVisible(true)}
                            style={{
                              flex: 1,
                              backgroundColor: "#F4F5F7",
                              borderRadius: 14,
                              paddingVertical: spacing.sm,
                              paddingHorizontal: spacing.md,
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: fontSizes.FONT14 }}>
                              👤{" "}
                              {t("studentsOnBoard", {
                                count: currentCheckpointEmployees,
                              })}
                            </Text>
                          </TouchableOpacity>
                          <View
                            style={{
                              flex: 1,
                              backgroundColor: "#F4F5F7",
                              borderRadius: 14,
                              paddingVertical: spacing.sm,
                              paddingHorizontal: spacing.md,
                            }}
                          >
                            <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: fontSizes.FONT14 }}>
                              📞 {trip.company?.name || t("schoolCoordFallback")}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleReachCheckpoint(index)}
                          disabled={updatingProgress || !isWithinRange(index)}
                          style={{
                            marginTop: spacing.md,
                            borderRadius: 14,
                            backgroundColor:
                              updatingProgress || !isWithinRange(index)
                                ? "#D1D5DB"
                                : color.primary,
                            paddingVertical: spacing.sm,
                            alignItems: "center",
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ color: color.whiteColor, fontFamily: fonts.bold, fontSize: fontSizes.FONT14 }}>
                            {updatingProgress ? t("updating") : t("markAsReached")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ flex: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.xs }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text
                            style={{
                              color: colors.text,
                              fontFamily: fonts.bold,
                              fontSize: fontSizes.FONT34,
                              textDecorationLine: isReached ? "line-through" : "none",
                              opacity: isReached ? 0.5 : 1,
                            }}
                          >
                            {point.name}
                          </Text>
                          <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: fontSizes.FONT22, opacity: isReached ? 0.5 : 1 }}>
                            {formatClockTime(point.expectedTime)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {!isCompleted && trip.status === "ACTIVE" && (
              <EmergencyEndSlider
                onConfirm={handleEmergencyTerminate}
                disabled={!canUseEmergency}
                disabledMessage={emergencyDisabledMessage}
              />
            )}
        </DraggableBottomSheet>
      </View>

      {/* Employee Bottom Sheet */}
      {currentPoint && (
        <EmployeeBottomSheet
          visible={
            isEmployeeSheetVisible &&
            !!currentPoint.employees &&
            currentPoint.employees.length > 0
          }
          onClose={() => setIsEmployeeSheetVisible(false)}
          checkpointName={currentPoint.name}
          employees={currentPoint.employees || []}
        />
      )}
    </View>
  );
}
