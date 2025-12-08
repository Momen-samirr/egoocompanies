/**
 * REFACTORED Home Screen
 * This version uses custom hooks for better separation of concerns
 * and improved maintainability
 */

import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
  RefreshControl,
} from "react-native";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import Header from "@/components/common/header";
import { useTheme } from "@react-navigation/native";
import { external } from "@/styles/external.style";
import styles from "./styles";
import { windowHeight, fontSizes } from "@/themes/app.constant";
import { Calender } from "@/utils/icons";
import color from "@/themes/app.colors";
import { spacing, shadows } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import { router } from "expo-router";
import { Toast } from "react-native-toast-notifications";
import { useGetDriverData } from "@/hooks/useGetDriverData";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getServerUri, getWebSocketUrl } from "@/configs/constants";
import OverviewSection from "@/components/home/OverviewSection";
import RideRequestModal, {
  RideRequestData,
} from "@/components/home/RideRequestModal";
import { useNotificationHandler } from "@/hooks/useNotificationHandler";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useLocationTracking, Location } from "@/hooks/useLocationTracking";
import { runMapDiagnostics, logMapDiagnostics } from "@/utils/mapDiagnostics";
import {
  hasBackgroundLocationPermission,
  getLocationPermissionStatus,
} from "@/utils/locationPermissions";
import {
  ensureBatteryOptimizationDisabled,
  setupPeriodicBatteryOptimizationCheck,
  cleanupPeriodicBatteryOptimizationCheck,
} from "@/utils/batteryOptimization";
import { logger } from "@/lib/logger";
import { AppState, AppStateStatus } from "react-native";

export default function HomeScreen() {
  const { driver, loading: DriverDataLoading } = useGetDriverData();
  const { colors } = useTheme();

  // State management
  const [isOn, setIsOn] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [rideRequestData, setRideRequestData] =
    useState<RideRequestData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const isOnRef = useRef<boolean>(false);
  const isModalVisibleRef = useRef<boolean>(false);

  // Initialize notification handler
  const { handleNotification } = useNotificationHandler({
    onRideRequest: useCallback(
      (data: RideRequestData) => {
        logger.info("Ride request received via notification handler", data);
        // Calculate estimated fare if not provided and driver rate is available
        if (!data.estimatedFare && driver?.rate) {
          const distance = parseFloat(data.distance || "0");
          data.estimatedFare = (
            distance * parseInt(driver.rate || "0")
          ).toFixed(2);
        }
        // Ensure estimatedDistance is set
        if (!data.estimatedDistance) {
          data.estimatedDistance = parseFloat(data.distance || "0");
        }
        setRideRequestData(data);
        setIsModalVisible(true);
      },
      [driver?.rate]
    ),
    onTripActivation: useCallback((data) => {
      logger.info("Trip activation notification", data);
      setTimeout(() => {
        router.push("/(routes)/scheduled-trips");
      }, 2000);
    }, []),
  });

  // Initialize push notifications
  usePushNotifications({
    driverId: driver?.id,
    enabled: !!driver?.id,
  });

  // WebSocket connection for location updates
  const ws = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // WebSocket connection setup
  useEffect(() => {
    isMountedRef.current = true;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;

    const connectWebSocket = () => {
      if (!isMountedRef.current) return;

      try {
        const wsUrl = getWebSocketUrl();
        logger.info("Connecting to WebSocket", {
          url: wsUrl,
          attempt: reconnectAttempts + 1,
        });

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          if (!isMountedRef.current) return;
          logger.info("WebSocket connected");
          setWsConnected(true);
          reconnectAttempts = 0; // Reset on successful connection
        };

        ws.current.onclose = (e) => {
          if (!isMountedRef.current) return;
          logger.info("WebSocket closed", { code: e.code, reason: e.reason });
          setWsConnected(false);

          // Reconnect after delay if not manually closed and haven't exceeded max attempts
          if (
            e.code !== 1000 &&
            reconnectAttempts < maxReconnectAttempts &&
            isMountedRef.current
          ) {
            reconnectAttempts++;
            const delay = Math.min(
              3000 * Math.pow(2, reconnectAttempts - 1),
              30000
            ); // Exponential backoff, max 30s
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                connectWebSocket();
              }
            }, delay);
          }
        };

        ws.current.onerror = (error) => {
          logger.error("WebSocket error", error);
          setWsConnected(false);
        };
      } catch (error) {
        logger.error("Failed to create WebSocket", error);
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      logger.debug("Cleaning up WebSocket connection");

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (ws.current) {
        try {
          ws.current.close(1000, "Component unmounting");
        } catch (error) {
          logger.error("Error closing WebSocket", error);
        }
        ws.current = null;
      }
      setWsConnected(false);
    };
  }, []);

  // Create WebSocket send callback
  const sendLocationViaWebSocket = useCallback(
    (location: Location, driverData: any) => {
      // Send via WebSocket
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
          type: "locationUpdate",
          data: {
            latitude: location.latitude,
            longitude: location.longitude,
            heading: location.heading !== undefined ? location.heading : null,
            name: driverData.name || "Driver",
            status: driverData.status || "active",
            vehicleType: driverData.vehicle_type || "Car",
          },
          role: "driver",
          driver: driverData.id,
        });
        ws.current.send(message);
        logger.debug("Location update sent via WebSocket", {
          driverId: driverData.id,
          location: { lat: location.latitude, lng: location.longitude },
        });
      }
    },
    []
  );

  // Location tracking with WebSocket integration
  const {
    currentLocation,
    isTracking,
    error: locationError,
  } = useLocationTracking({
    isActive: isOn,
    sendToServer: true,
    sendToWebSocket: sendLocationViaWebSocket,
    distanceThreshold: 200,
  });

  // Load driver status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      const status: string | null = await AsyncStorage.getItem("status");
      const newIsOn = status === "active";
      logger.debug(
        `Driver status loaded from storage: "${status}" -> isOn=${newIsOn}`
      );
      setIsOn(newIsOn);
      isOnRef.current = newIsOn;
    };
    fetchStatus();
  }, []);

  // Keep refs in sync
  useEffect(() => {
    isOnRef.current = isOn;
  }, [isOn]);

  useEffect(() => {
    isModalVisibleRef.current = isModalVisible;
  }, [isModalVisible]);

  // Set up notification handler
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        logger.debug("Notification handler called", {
          id: notification.request.identifier,
          title: notification.request.content.title,
          data: notification.request.content.data,
        });

        return {
          shouldShowAlert: false,
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      },
    });

    // Set up notification listeners
    logger.info("Setting up notification listeners");

    Notifications.getPermissionsAsync()
      .then((permissions) => {
        logger.debug("Notification permissions", permissions);
        if (!permissions.granted) {
          logger.warn("Notification permissions not granted");
          Toast.show(
            "Notification permissions not granted. Please enable notifications in settings.",
            {
              type: "danger",
              duration: 5000,
            }
          );
        }
      })
      .catch((error) => {
        logger.error("Error checking notification permissions", error);
      });

    // Foreground notification listener
    const foregroundSubscription =
      Notifications.addNotificationReceivedListener((notification) => {
        logger.info("Notification received in foreground", {
          id: notification.request.identifier,
        });

        // Use ref to check modal state to avoid dependency on isModalVisible
        if (isModalVisibleRef.current) {
          logger.debug("Modal already visible, ignoring notification");
          return;
        }

        Toast.show("New ride request received!", {
          type: "success",
          duration: 3000,
        });

        const data = notification.request.content.data;
        if (data) {
          handleNotification(data, notification.request.identifier);
        } else {
          logger.warn("Notification received but no data found");
          Toast.show("Notification received but no data found", {
            type: "warning",
            duration: 3000,
          });
        }
      });

    // Notification tapped listener
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        logger.info("Notification tapped", {
          actionIdentifier: response.actionIdentifier,
        });

        // Use ref to check modal state to avoid dependency on isModalVisible
        if (isModalVisibleRef.current) {
          logger.debug("Modal already visible, ignoring tapped notification");
          return;
        }

        const data = response.notification.request.content.data;
        if (data) {
          setTimeout(() => {
            handleNotification(data, response.notification.request.identifier);
          }, 500);
        }
      });

    // Check if app was opened from notification
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          logger.info("App opened from notification");
          const data = response.notification.request.content.data;
          if (data) {
            setTimeout(() => {
              handleNotification(
                data,
                response.notification.request.identifier
              );
            }, 1000);
          }
        }
      })
      .catch((error) => {
        logger.error("Error checking last notification", error);
      });

    return () => {
      logger.debug("Cleaning up notification listeners");
      if (foregroundSubscription) {
        Notifications.removeNotificationSubscription(foregroundSubscription);
      }
      if (responseSubscription) {
        Notifications.removeNotificationSubscription(responseSubscription);
      }
    };
  }, [handleNotification]); // Removed isModalVisible - using ref instead

  // Monitor AppState for permission checks
  useEffect(() => {
    let lastAppState: AppStateStatus | null = null;
    let debounceTimeout: NodeJS.Timeout | null = null;

    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        // Debounce rapid state changes
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }

        debounceTimeout = setTimeout(async () => {
          // Only log if state actually changed
          if (lastAppState !== nextAppState) {
            lastAppState = nextAppState;

            // Only log significant state changes, not every rapid change
            if (nextAppState === "background" || nextAppState === "inactive") {
              const hasBackground = await hasBackgroundLocationPermission();
              if (!hasBackground && isOnRef.current) {
                logger.warn(
                  "App in background but background location permission not granted"
                );
                Toast.show(
                  "Background location permission required for tracking when screen is off",
                  {
                    type: "warning",
                    duration: 3000,
                  }
                );
              }
            } else if (nextAppState === "active" && isOnRef.current) {
              // Only check permissions when app becomes active, not on every state change
              const permissionStatus = await getLocationPermissionStatus();
              logger.debug("Permission status on foreground", permissionStatus);

              if (!permissionStatus.background && Platform.OS === "android") {
                logger.warn(
                  "Background location permission may have been revoked"
                );
              }
            }
          }
        }, 500); // 500ms debounce
      }
    );

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      subscription.remove();
    };
  }, []);

  // Run map diagnostics on mount
  useEffect(() => {
    runMapDiagnostics().then((diagnostics) => {
      logMapDiagnostics(diagnostics);
      if (diagnostics.errors.length > 0) {
        setMapError(diagnostics.errors.join(", "));
      }
    });
  }, []);

  // Cleanup battery optimization checks on unmount
  useEffect(() => {
    return () => {
      if (Platform.OS === "android") {
        cleanupPeriodicBatteryOptimizationCheck();
      }
    };
  }, []);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Handle status change
  const handleStatusChange = useCallback(async () => {
    if (loading) return;

    logger.info("Starting status change", {
      currentStatus: isOn ? "active" : "inactive",
    });
    setLoading(true);

    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        logger.error("No access token for status change");
        setLoading(false);
        return;
      }

      const newStatus = !isOn ? "active" : "inactive";
      logger.debug("Changing status to", { newStatus });

      const changeStatus = await axios.put(
        `${getServerUri()}/driver/update-status`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (changeStatus.data) {
        const newIsOn = !isOn;
        setIsOn(newIsOn);
        isOnRef.current = newIsOn;
        await AsyncStorage.setItem("status", changeStatus.data.driver.status);

        logger.info("Status updated successfully", { newStatus });

        if (newStatus === "active") {
          // Check background permission
          const hasBackground = await hasBackgroundLocationPermission();
          if (!hasBackground) {
            logger.warn("Background location permission not granted");
            Toast.show(
              "Background location is required for tracking when screen is off",
              {
                type: "warning",
                duration: 4000,
              }
            );
          }

          // Check and prompt for battery optimization when driver activates
          // This ensures location tracking works when screen is off
          if (Platform.OS === "android") {
            setTimeout(async () => {
              await ensureBatteryOptimizationDisabled();
            }, 2000);
          }

          // Setup periodic battery optimization checks
          if (Platform.OS === "android") {
            setupPeriodicBatteryOptimizationCheck(
              () => isOnRef.current,
              60 // Check every hour
            );
          }

          // Location will be sent automatically by useLocationTracking hook
          logger.debug("Driver went active - location tracking will start");
        } else {
          // Clean up periodic battery optimization checks when driver goes inactive
          if (Platform.OS === "android") {
            cleanupPeriodicBatteryOptimizationCheck();
          }
          // Driver going inactive - notify WebSocket
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({
              type: "driverStatusChange",
              role: "driver",
              driver: changeStatus.data.driver.id,
              status: "inactive",
            });
            ws.current.send(message);
          }
        }
      }
    } catch (error: any) {
      logger.error("Error changing driver status", error);
      Toast.show("Failed to update status. Please try again.", {
        type: "danger",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [loading, isOn, currentLocation, ws]);

  // Handle ride acceptance
  const acceptRideHandler = useCallback(async () => {
    if (loading || !rideRequestData) {
      logger.debug("Already processing ride acceptance or no ride data");
      return;
    }

    setLoading(true);

    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        throw new Error("No access token");
      }

      const res = await axios.post(
        `${getServerUri()}/driver/new-ride`,
        {
          userId: rideRequestData.user?.id,
          charge: rideRequestData.estimatedFare,
          status: "Processing",
          currentLocationName: rideRequestData.pickupLocationName,
          destinationLocationName: rideRequestData.destinationLocationName,
          distance: rideRequestData.distance,
          currentLocation: rideRequestData.pickupLocation,
          marker: rideRequestData.destinationLocation,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // Close modal
      setIsModalVisible(false);
      setRideRequestData(null);

      // Send push notification to user if token available
      if (rideRequestData.user?.notificationToken) {
        const notificationData = {
          ...driver,
          currentLocation: rideRequestData.pickupLocation,
          marker: rideRequestData.destinationLocation,
          distance: rideRequestData.distance,
        };

        await axios
          .post("https://exp.host/--/api/v2/push/send", {
            to: rideRequestData.user.notificationToken,
            sound: "default",
            title: "Ride Request Accepted!",
            body: "Your driver is on the way!",
            data: { orderData: notificationData },
          })
          .catch((error) => {
            logger.warn("Failed to send push notification to user", error);
          });
      }

      // Navigate to ride details
      const rideData = {
        user: rideRequestData.user,
        currentLocation: rideRequestData.pickupLocation,
        marker: rideRequestData.destinationLocation,
        driver,
        distance: rideRequestData.distance,
        rideData: res.data.newRide,
      };

      router.push({
        pathname: "/(routes)/ride-details",
        params: { orderData: JSON.stringify(rideData) },
      });
    } catch (error: any) {
      logger.error("Error accepting ride", error);
      Toast.show("Failed to accept ride. Please try again.", {
        type: "danger",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [loading, rideRequestData, driver]);

  // Handle modal close
  const handleClose = useCallback(() => {
    setIsModalVisible(false);
    setRideRequestData(null);
  }, []);

  // Map handlers
  const handleMapReady = useCallback(() => {
    logger.info("Home screen map ready and loaded successfully");
    setMapReady(true);
    setMapLoading(false);
    setMapError(null);
  }, []);

  const handleMapError = useCallback((error: any) => {
    logger.error("Home screen map error", error);
    setMapError(`Map error: ${error.message || "Unknown error"}`);
    setMapLoading(false);
  }, []);

  const handleRegionChange = useCallback((newRegion: any) => {
    // Region change handled by RideRequestModal
  }, []);

  return (
    <View style={[external.fx_1, { backgroundColor: colors.background }]}>
      <Header
        isOn={isOn}
        toggleSwitch={handleStatusChange}
        loading={loading}
        showOnlineStatus={true}
      />
      <ScrollView
        style={styles.spaceBelow}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Scheduled Trips Card */}
        <TouchableOpacity
          onPress={() => router.push("/(routes)/scheduled-trips")}
          style={[
            {
              marginHorizontal: spacing.lg,
              marginTop: spacing.md,
              marginBottom: spacing.md,
              backgroundColor: colors.card,
              padding: spacing.lg,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              ...shadows.md,
            },
          ]}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: `${color.primary}20`,
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.md,
              }}
            >
              <Calender colors={color.primary} width={24} height={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: fontSizes.FONT18,
                  fontFamily: fonts.bold,
                  color: colors.text,
                  marginBottom: spacing.xs / 2,
                }}
              >
                Scheduled Trips
              </Text>
              <Text
                style={{
                  fontSize: fontSizes.FONT14,
                  fontFamily: fonts.regular,
                  color: color.text.secondary,
                }}
              >
                View and manage your scheduled trips
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Overview Section */}
        <OverviewSection refreshTrigger={refreshTrigger} />
      </ScrollView>

      {/* Ride Request Modal */}
      <RideRequestModal
        visible={isModalVisible}
        data={rideRequestData}
        loading={loading}
        mapError={mapError}
        mapLoading={mapLoading}
        mapReady={mapReady}
        onClose={handleClose}
        onAccept={acceptRideHandler}
        onRegionChange={handleRegionChange}
        onMapReady={handleMapReady}
        onMapError={handleMapError}
      />
    </View>
  );
}
