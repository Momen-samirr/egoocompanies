import { useEffect, useRef, useState, useCallback } from "react";
import * as GeoLocation from "expo-location";
import { Toast } from "react-native-toast-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getServerUri } from "@/configs/constants";
import { requestAllLocationPermissions, getLocationPermissionStatus } from "@/utils/locationPermissions";
import { shouldSendLocationUpdate } from "@/utils/locationOptimizer";
import { updateDriverLocation } from "@/services/locationService";

export interface Location {
  latitude: number;
  longitude: number;
}

export interface UseLocationTrackingOptions {
  isActive: boolean;
  onLocationUpdate?: (location: Location) => void;
  sendToServer?: boolean;
  sendToWebSocket?: (location: Location, driverData: any) => void;
  distanceThreshold?: number; // meters
}

export interface UseLocationTrackingReturn {
  currentLocation: Location | null;
  lastSentLocation: Location | null;
  isTracking: boolean;
  error: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

/**
 * Custom hook for location tracking
 * Handles location permissions, watching position, and sending updates
 */
export function useLocationTracking(
  options: UseLocationTrackingOptions
): UseLocationTrackingReturn {
  const {
    isActive,
    onLocationUpdate,
    sendToServer = true,
    sendToWebSocket,
    distanceThreshold = 200, // 200 meters default
  } = options;

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [lastSentLocation, setLastSentLocation] = useState<Location | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationWatchSubscription = useRef<any>(null);
  const isActiveRef = useRef(isActive);
  const firstLocationAfterActiveRef = useRef(false);

  // Keep ref in sync with isActive
  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive && !firstLocationAfterActiveRef.current) {
      firstLocationAfterActiveRef.current = true;
    }
  }, [isActive]);

  // Send location update to server/WebSocket
  const sendLocationUpdate = useCallback(
    async (location: Location) => {
      const currentIsActive = isActiveRef.current;
      if (!currentIsActive) {
        console.log("⚠️ Driver is inactive - skipping location update");
        return;
      }

      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        if (!accessToken) {
          console.error("❌ No access token - cannot fetch driver data");
          return;
        }

        // Get driver data
        const driverResponse = await axios.get(`${getServerUri()}/driver/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (driverResponse.data && driverResponse.data.driver) {
          const driverData = driverResponse.data.driver;
          const driverStatus = driverData.status || "active";

          // Send to WebSocket if handler provided
          if (sendToWebSocket) {
            sendToWebSocket(location, driverData);
          }

          // Send to server for scheduled trips
          if (sendToServer) {
            try {
              const response = await updateDriverLocation(location);
              if (response.success && response.activationChecks) {
                const availableTrips = response.activationChecks.filter(
                  (check: any) => check.canActivate
                );
                if (availableTrips.length > 0) {
                  console.log(`✅ ${availableTrips.length} trip(s) are now available to start`);
                }
              }
            } catch (error: any) {
              if (error.response?.status === 400 && error.response?.data?.message?.includes("online")) {
                console.log("⚠️ Location update skipped - driver is offline");
              } else {
                console.log("⚠️ Failed to update location for scheduled trips:", error.message);
              }
            }
          }

          console.log(
            `✅ Location update sent: Driver=${driverData.id}, Lat=${location.latitude}, Lng=${location.longitude}`
          );
        }
      } catch (error: any) {
        console.error("❌ Error sending location update:", error);
      }
    },
    [sendToServer, sendToWebSocket]
  );

  // Start location tracking
  const startTracking = useCallback(async () => {
    try {
      // Clean up previous subscription
      if (locationWatchSubscription.current) {
        locationWatchSubscription.current.remove();
        locationWatchSubscription.current = null;
      }

      // Request permissions
      console.log("📍 Requesting location permissions...");
      const { foreground, background } = await requestAllLocationPermissions();

      if (!foreground) {
        setError("Location permission denied");
        Toast.show("Please grant location permission to use this app!", {
          type: "danger",
        });
        return;
      }

      if (!background) {
        console.warn("⚠️ Background location permission not granted");
        Toast.show("Background location is required for tracking when screen is off. Please enable it in Settings.", {
          type: "warning",
          duration: 5000,
        });
      }

      const permissionStatus = await getLocationPermissionStatus();
      console.log("📍 Location permission status:", permissionStatus);

      // Reset first location flag
      firstLocationAfterActiveRef.current = isActiveRef.current;

      // Start watching position
      const subscription = await GeoLocation.watchPositionAsync(
        {
          accuracy: GeoLocation.Accuracy.High,
          timeInterval: 5000, // 5 seconds
          distanceInterval: 10, // 10 meters
          mayShowUserSettingsDialog: true,
        },
        async (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation: Location = { latitude, longitude };

          // Always update current location
          setCurrentLocation(newLocation);

          // Call onLocationUpdate callback
          if (onLocationUpdate) {
            onLocationUpdate(newLocation);
          }

          // Check if we should send update
          const currentIsActive = isActiveRef.current;
          const shouldSend =
            firstLocationAfterActiveRef.current ||
            shouldSendLocationUpdate(lastSentLocation, newLocation, distanceThreshold);

          if (currentIsActive && shouldSend) {
            const isFirstAfterActive = firstLocationAfterActiveRef.current;
            firstLocationAfterActiveRef.current = false;

            setLastSentLocation(newLocation);

            await sendLocationUpdate(newLocation);
          } else {
            // Update lastSentLocation even if not sending
            setLastSentLocation(newLocation);
            if (!currentIsActive) {
              console.log(`📍 Location received but driver is inactive - not sending`);
            } else {
              console.log(`📍 Location update skipped (change < ${distanceThreshold}m)`);
            }
          }
        }
      );

      locationWatchSubscription.current = subscription;
      setIsTracking(true);
      setError(null);
      console.log("✅ Location tracking started");
    } catch (err: any) {
      console.error("❌ Error starting location tracking:", err);
      setError(err.message || "Failed to start location tracking");
      setIsTracking(false);
    }
  }, [onLocationUpdate, sendLocationUpdate, distanceThreshold, lastSentLocation]);

  // Stop location tracking
  const stopTracking = useCallback(() => {
    if (locationWatchSubscription.current) {
      locationWatchSubscription.current.remove();
      locationWatchSubscription.current = null;
    }
    setIsTracking(false);
    console.log("🛑 Location tracking stopped");
  }, []);

  // Start/stop tracking based on isActive
  useEffect(() => {
    if (isActive) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [isActive, startTracking, stopTracking]);

  return {
    currentLocation,
    lastSentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking,
  };
}

