import {
  View,
  Text,
  FlatList,
  Modal,
  TouchableOpacity,
  Platform,
  ScrollView,
  Alert,
  AppState,
  AppStateStatus,
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
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { windowHeight, windowWidth, fontSizes } from "@/themes/app.constant";
import { Gps, Location, Calender, Wallet, FillClock, SmartCar } from "@/utils/icons";
import color from "@/themes/app.colors";
import Button from "@/components/common/button";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as GeoLocation from "expo-location";
import { Toast } from "react-native-toast-notifications";
import { useGetDriverData } from "@/hooks/useGetDriverData";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
// Lazy load expo-device to prevent UserHandle serialization error on module initialization
// import * as Device from "expo-device";
import { router } from "expo-router";
import { getWebSocketUrl, getServerUri } from "@/configs/constants";
import EmptyState from "@/components/common/EmptyState";
import PassengerCard from "@/components/ride/PassengerCard";
import ETADisplay from "@/components/common/ETADisplay";
import { spacing, shadows, borderRadius } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import DriverStatusCard from "@/components/home/DriverStatusCard";
import { runMapDiagnostics, logMapDiagnostics } from "@/utils/mapDiagnostics";
import {
  requestAllLocationPermissions,
  hasBackgroundLocationPermission,
  getLocationPermissionStatus,
} from "@/utils/locationPermissions";
import {
  promptDisableBatteryOptimization,
  showBatteryOptimizationInstructions,
} from "@/utils/batteryOptimization";
import { shouldSendLocationUpdate } from "@/utils/locationOptimizer";
import {
  setWebSocketConnection,
  BACKGROUND_LOCATION_TASK,
} from "@/services/backgroundLocationTask";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { useHomeDashboardData } from "@/hooks/useHomeDashboardData";
import { useTranslation } from "react-i18next";
// Conditionally import TaskManager to avoid errors if native module isn't ready
let TaskManager: any = null;
try {
  TaskManager = require("expo-task-manager");
} catch (error) {
  console.warn("⚠️ expo-task-manager not available:", error);
}

export default function HomeScreen() {
  const { t } = useTranslation("home");
  const { t: tn } = useTranslation("notifications");
  const { t: tc } = useTranslation("common");
  const notificationListener = useRef<any>();
  const { driver, loading: DriverDataLoading } = useGetDriverData();
  const [userData, setUserData] = useState<any>(null);
  const [isOn, setIsOn] = useState<any>();
  const [loading, setloading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showOfflineConfirmation, setShowOfflineConfirmation] = useState(false);
  const [region, setRegion] = useState<any>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [currentLocationName, setcurrentLocationName] = useState("");
  const [destinationLocationName, setdestinationLocationName] = useState("");
  const [distance, setdistance] = useState<any>();
  const [wsConnected, setWsConnected] = useState(false);
  const [marker, setMarker] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [lastLocation, setLastLocation] = useState<any>(null);
  const ws = useRef<WebSocket | null>(null);
  const isOnRef = useRef<any>(undefined); // Track isOn in ref so callbacks always have latest value
  const processedNotificationIds = useRef<Set<string>>(new Set()); // Track processed notification IDs to prevent duplicates
  const isProcessingNotification = useRef<boolean>(false); // Prevent concurrent notification processing
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null); // Keep-alive ping interval
  const isComponentUnmountingRef = useRef<boolean>(false); // Track if component is unmounting vs app backgrounding
  const wsReconnectAttemptsRef = useRef<number>(0); // Track reconnection attempts across re-renders
  const wsAppStateSubscriptionRef = useRef<any>(null); // AppState subscription for WebSocket

  // Push notification registration state tracking
  const isRegisteringToken = useRef<boolean>(false); // Prevent concurrent token registrations
  const tokenRegistrationCompleted = useRef<boolean>(false); // Track if token registration was completed
  const lastSavedToken = useRef<string | null>(null); // Store the last successfully saved token
  const appStateRegistrationTimeout = useRef<NodeJS.Timeout | null>(null); // For debouncing AppState listener

  // Map error handling state
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);

  const { colors } = useTheme();
  const {
    loading: dashboardLoading,
    refreshing: dashboardRefreshing,
    data: dashboardData,
    refreshDashboardData,
    revalidateDashboardData,
  } = useHomeDashboardData();

  // Safe wrapper to check if device is physical (without using expo-device to avoid UserHandle error)
  // The expo-device module causes a UserHandle serialization error on subsequent app launches
  // We avoid using it entirely and use Platform detection instead
  const isPhysicalDevice = (): boolean => {
    // On Android, we can't reliably detect emulator without expo-device
    // But for push notifications, we'll assume it's a physical device
    // This is safe because push notifications work on both emulators and devices
    // The main check (isDevice) was to prevent showing errors on emulators
    // Since we're handling errors gracefully, we can allow it on all platforms
    if (Platform.OS === "android") {
      // On Android, assume physical device to allow push notifications
      // The error handling will catch any issues
      return true;
    }
    // On iOS, expo-device works fine, but we'll also default to true
    // to avoid any potential issues
    return true;
  };

  const onRefresh = React.useCallback(() => {
    refreshDashboardData();
  }, [refreshDashboardData]);

  // CRITICAL: Set up notification handler BEFORE listeners
  // This handler determines how notifications are displayed when app is in foreground
  // IMPORTANT: We MUST return shouldShowAlert: false to allow the listener to process it
  // If we return shouldShowAlert: true, Expo shows a system notification but the listener might not fire
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      console.log("🔔 ===== NOTIFICATION HANDLER CALLED =====");
      console.log("🔔 Handler timestamp:", new Date().toISOString());
      console.log("🔔 Notification ID:", notification.request.identifier);
      console.log("🔔 Notification title:", notification.request.content.title);
      console.log("🔔 Notification body:", notification.request.content.body);
      console.log(
        "🔔 Notification data:",
        JSON.stringify(notification.request.content.data, null, 2)
      );
      console.log("🔔 Notification trigger:", notification.request.trigger);

      // CRITICAL: Return shouldShowAlert: false to allow JavaScript listener to handle it
      // If we return true, Expo shows a system notification and the listener might not fire
      // We want to process the notification in JavaScript to show the modal
      return {
        shouldShowAlert: false, // Don't show system alert - let JavaScript handle it
        shouldPlaySound: true, // Play sound
        shouldSetBadge: false, // Don't set badge
      };
    },
  });

  // Helper function to handle notification data
  const handleNotificationData = (
    notificationData: any,
    notificationId?: string
  ) => {
    try {
      // Prevent concurrent processing of notifications
      if (isProcessingNotification.current) {
        console.log("⚠️ Already processing a notification, ignoring duplicate");
        return;
      }

      // Create a unique ID for this notification based on user data and timestamp
      // If notificationId is provided, use it; otherwise create one from data
      let uniqueId: string;
      if (notificationId) {
        uniqueId = notificationId;
      } else {
        // Create ID from notification data (user ID + timestamp or user phone)
        const userPhone =
          notificationData?.orderData?.user?.phone_number ||
          notificationData?.user?.phone_number ||
          notificationData?.orderData?.user?.id ||
          notificationData?.user?.id ||
          Date.now().toString();
        uniqueId = `notification_${userPhone}_${Date.now()}`;
      }

      // Check if this notification was already processed
      if (processedNotificationIds.current.has(uniqueId)) {
        console.log(
          `⚠️ Notification ${uniqueId} already processed, ignoring duplicate`
        );
        return;
      }

      // Mark as processing
      isProcessingNotification.current = true;

      // Mark this notification ID as processed
      processedNotificationIds.current.add(uniqueId);

      // Clean up old notification IDs (keep only last 10 to prevent memory leak)
      if (processedNotificationIds.current.size > 10) {
        const firstId = processedNotificationIds.current.values().next().value;
        if (firstId) {
          processedNotificationIds.current.delete(firstId);
        }
      }

      console.log(
        "📬 Processing notification data:",
        JSON.stringify(notificationData, null, 2)
      );
      console.log("📬 Notification ID:", uniqueId);

      // The notification data structure from Expo is: notification.request.content.data
      // And we send: { orderData: JSON.stringify(data) }
      // So we need to extract orderData and parse it
      let orderData;

      // Check if notificationData has orderData property
      if (notificationData && notificationData.orderData) {
        // orderData might be a stringified JSON or already an object
        if (typeof notificationData.orderData === "string") {
          try {
            orderData = JSON.parse(notificationData.orderData);
            console.log("✅ Parsed orderData from string:", orderData);
          } catch (parseError) {
            console.error("❌ Error parsing orderData string:", parseError);
            // Maybe it's already parsed somehow? Try using it directly
            orderData = notificationData.orderData;
          }
        } else {
          // Already an object
          orderData = notificationData.orderData;
          console.log("✅ Using orderData as object:", orderData);
        }
      } else if (typeof notificationData === "string") {
        // Maybe the entire notificationData is a stringified JSON
        try {
          orderData = JSON.parse(notificationData);
          console.log("✅ Parsed entire notificationData as JSON:", orderData);
        } catch (parseError) {
          console.error(
            "❌ Error parsing notificationData as JSON:",
            parseError
          );
          return;
        }
      } else {
        // Maybe notificationData itself is the orderData
        orderData = notificationData;
        console.log(
          "✅ Using notificationData directly as orderData:",
          orderData
        );
      }

      console.log("📦 Final orderData:", JSON.stringify(orderData, null, 2));

      // Check if this is a trip activation notification
      if (orderData && orderData.type === "tripActivation") {
        console.log("📬 Trip activation notification received:", orderData);
        Toast.show(
          tn("tripNowAvailable", { tripName: orderData.tripName }),
          {
            type: "success",
            duration: 5000,
          }
        );
        // Navigate to scheduled trips screen
        setTimeout(() => {
          router.push("/(routes)/scheduled-trips");
        }, 2000);
        return;
      }

      // Validate required fields
      if (!orderData) {
        console.error("❌ No orderData found in notification");
        Toast.show(tn("invalidFormat"), {
          type: "danger",
        });
        return;
      }

      if (!orderData.currentLocation || !orderData.marker || !orderData.user) {
        console.error("❌ Invalid notification data - missing required fields");
        console.error("Missing fields:", {
          hasCurrentLocation: !!orderData.currentLocation,
          hasMarker: !!orderData.marker,
          hasUser: !!orderData.user,
        });
        Toast.show(tn("invalidRideData"), {
          type: "danger",
        });
        return;
      }

      // Set location data first
      const pickupLocation = {
        latitude: orderData.currentLocation.latitude,
        longitude: orderData.currentLocation.longitude,
      };

      const destinationLocation = {
        latitude: orderData.marker.latitude,
        longitude: orderData.marker.longitude,
      };

      setCurrentLocation(pickupLocation);
      setMarker(destinationLocation);

      // Calculate region
      const latDelta =
        Math.abs(pickupLocation.latitude - destinationLocation.latitude) * 2;
      const lonDelta =
        Math.abs(pickupLocation.longitude - destinationLocation.longitude) * 2;

      setRegion({
        latitude: (pickupLocation.latitude + destinationLocation.latitude) / 2,
        longitude:
          (pickupLocation.longitude + destinationLocation.longitude) / 2,
        latitudeDelta: Math.max(latDelta, 0.0922),
        longitudeDelta: Math.max(lonDelta, 0.0421),
      });

      setdistance(orderData.distance || "0");
      setcurrentLocationName(
        orderData.currentLocationName ||
          orderData.currentLocation?.name ||
          tc("pickupLocation")
      );
      setdestinationLocationName(
        orderData.destinationLocation ||
          orderData.destinationLocationName ||
          orderData.marker?.name ||
          tc("destination")
      );
      setUserData(orderData.user);

      console.log("✅ All data set successfully!");
      console.log("✅ User:", orderData.user?.name);
      console.log("✅ Distance:", orderData.distance);
      console.log("✅ Pickup:", orderData.currentLocationName);
      console.log("✅ Destination:", orderData.destinationLocation);

      // Set modal visible LAST - this should trigger the modal to show
      console.log("🎯 STEP 9: Setting modal visible to true");
      console.log("🎯 Current modal state:", isModalVisible);

      // CRITICAL: Update modal state immediately and forcefully
      // Use functional update to ensure React processes it
      setIsModalVisible(true);
      console.log("✅ STEP 10: Modal state set to true (immediate)");

      // Also use functional update as backup
      setIsModalVisible((prev) => {
        console.log("🔄 Modal state functional update, prev:", prev);
        return true;
      });

      // Force re-render after tiny delay to ensure state change is processed
      setTimeout(() => {
        console.log("🔄 STEP 11: Force updating modal state...");
        setIsModalVisible(true);
        console.log("✅ STEP 12: Modal state force updated");
      }, 10);

      console.log("✅ STEP 13: Modal update complete - should be visible now");
    } catch (error: any) {
      console.error("❌ Error processing notification data:", error);
      console.error("Error stack:", error.stack);
      console.error(
        "Raw notification data:",
        JSON.stringify(notificationData, null, 2)
      );
      Toast.show(tn("errorProcessingRide", { message: error.message }), {
        type: "danger",
        duration: 5000,
      });
    } finally {
      // Always reset processing flag
      isProcessingNotification.current = false;
    }
  };

  // Handle notifications received while app is in foreground or background
  useEffect(() => {
    console.log("🔔 ===== SETTING UP NOTIFICATION LISTENERS =====");
    console.log("🔔 App state: Setting up listeners...");

    // Verify notification permissions first
    Notifications.getPermissionsAsync()
      .then((permissions) => {
        console.log(
          "🔔 Notification permissions:",
          JSON.stringify(permissions, null, 2)
        );
        if (!permissions.granted) {
          console.error("❌ Notification permissions not granted!");
          Toast.show(tn("permissionsNotGranted"), {
            type: "danger",
            duration: 5000,
          });
        } else {
          console.log("✅ Notification permissions granted");
        }
      })
      .catch((error) => {
        console.error("❌ Error checking notification permissions:", error);
      });

    // CRITICAL: Handle notifications received while app is in FOREGROUND
    // This listener will ONLY fire if shouldShowAlert: false in the notification handler
    // With shouldShowAlert: false, Expo won't show a system notification, and our listener will process it
    const foregroundSubscription =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("📱 ===== NOTIFICATION RECEIVED - LISTENER FIRED =====");
        console.log("📱 Listener timestamp:", new Date().toISOString());
        console.log("📱 Notification ID:", notification.request.identifier);
        console.log(
          "📱 Notification title:",
          notification.request.content.title
        );
        console.log("📱 Notification body:", notification.request.content.body);
        console.log(
          "📱 Notification trigger type:",
          notification.request.trigger?.type
        );
        console.log("📱 Notification structure check:", {
          hasRequest: !!notification.request,
          hasContent: !!notification.request?.content,
          hasData: !!notification.request?.content?.data,
          contentKeys: notification.request?.content
            ? Object.keys(notification.request.content)
            : [],
        });

        // Prevent processing if already processing or modal is visible
        if (isProcessingNotification.current || isModalVisible) {
          console.log(
            "⚠️ Already processing notification or modal visible, ignoring"
          );
          return;
        }

        // Show toast immediately to confirm notification was received
        Toast.show(tn("newRideRequest"), {
          type: "success",
          duration: 3000,
        });

        // Process notification IMMEDIATELY - no delays
        try {
          const data = notification.request.content.data;

          console.log("📦 STEP 1: Extracted data:", data);
          console.log("📦 STEP 2: Data type:", typeof data);
          console.log("📦 STEP 3: Data value:", data);
          console.log("📦 STEP 4: Data is null?", data === null);
          console.log("📦 STEP 5: Data is undefined?", data === undefined);
          console.log(
            "📦 STEP 6: Data keys:",
            data ? Object.keys(data) : "No keys"
          );
          console.log(
            "📦 STEP 7: Full data JSON:",
            JSON.stringify(data, null, 2)
          );

          if (!data) {
            console.error(
              "❌ ERROR: No data in notification.request.content.data"
            );
            console.error(
              "❌ Full notification content:",
              JSON.stringify(notification.request.content, null, 2)
            );
            Toast.show(tn("noDataFound"), {
              type: "warning",
              duration: 3000,
            });
            return;
          }

          // CRITICAL: Process notification data immediately with notification ID
          console.log("🔄 STEP 8: Calling handleNotificationData...");
          handleNotificationData(data, notification.request.identifier);
          console.log(
            "✅ STEP 9: handleNotificationData called - modal should appear"
          );
        } catch (error: any) {
          console.error("❌ ERROR: Exception in notification listener");
          console.error("❌ Error message:", error.message);
          console.error("❌ Error stack:", error.stack);
          console.error("❌ Error details:", JSON.stringify(error, null, 2));
          Toast.show(tn("errorGeneric", { message: error.message }), {
            type: "danger",
            duration: 5000,
          });
        }
      });

    // Handle notifications that open the app (when user TAPS on notification)
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("👆 ===== NOTIFICATION TAPPED - APP OPENED =====");
        console.log("👆 Timestamp:", new Date().toISOString());
        console.log("👆 Action identifier:", response.actionIdentifier);

        // Safely stringify response - may fail if it contains non-serializable objects
        try {
          console.log("👆 Full response:", JSON.stringify(response, null, 2));
        } catch (stringifyError) {
          console.warn(
            "⚠️ Could not stringify response (contains non-serializable data)"
          );
        }

        // Prevent processing if already processing or modal is visible
        if (isProcessingNotification.current || isModalVisible) {
          console.log(
            "⚠️ Already processing notification or modal visible, ignoring tapped notification"
          );
          return;
        }

        // Show a toast to indicate notification was tapped
        Toast.show(tn("tappedOpening"), {
          type: "info",
          duration: 3000,
        });

        try {
          // Safely extract data from notification response
          // This may fail if the response contains non-serializable objects like UserHandle
          let data;
          try {
            data = response.notification.request.content.data;
            console.log("📦 Raw data from tapped notification:", data);
            console.log("📦 Data type:", typeof data);

            // Safely stringify data
            try {
              console.log("📦 Extracted data:", JSON.stringify(data, null, 2));
            } catch (stringifyError) {
              console.warn(
                "⚠️ Could not stringify data (may contain non-serializable properties)"
              );
            }
          } catch (serializationError: any) {
            const errorMessage =
              serializationError?.message || String(serializationError);
            if (
              errorMessage.includes("UserHandle") ||
              errorMessage.includes("Could not put") ||
              errorMessage.includes("WritableMap")
            ) {
              console.warn(
                "⚠️ Notification response contains non-serializable data (UserHandle). This is a known Android issue."
              );
              console.warn(
                "⚠️ Attempting to extract data using alternative method..."
              );

              // Try to access data directly from the notification object
              try {
                const notification = response.notification;
                if (notification?.request?.content?.data) {
                  data = notification.request.content.data;
                }
              } catch (fallbackError) {
                console.error(
                  "❌ Could not extract notification data:",
                  fallbackError
                );
                Toast.show(tn("processManual"), {
                  type: "warning",
                  duration: 5000,
                });
                return;
              }
            } else {
              throw serializationError;
            }
          }

          if (!data) {
            console.error("❌ No data found in tapped notification");
            Toast.show(tn("tappedNoData"), {
              type: "warning",
              duration: 3000,
            });
            return;
          }

          // Delay slightly to ensure app is fully loaded
          console.log("🔄 Processing tapped notification data...");
          setTimeout(() => {
            handleNotificationData(
              data,
              response.notification.request.identifier
            );
          }, 500);
        } catch (error: any) {
          const errorMessage = error?.message || String(error);
          console.error("❌ Error handling tapped notification:", error);
          console.error("❌ Error stack:", error.stack);

          // Don't show error toast for serialization errors - they're expected
          if (
            !errorMessage.includes("UserHandle") &&
            !errorMessage.includes("Could not put") &&
            !errorMessage.includes("WritableMap")
          ) {
            Toast.show(tn("errorTapped", { message: errorMessage }), {
              type: "danger",
              duration: 5000,
            });
          }
        }
      });

    // Check if app was opened from a notification (when app was CLOSED)
    // Delay this call to ensure app is fully initialized and avoid serialization errors
    setTimeout(() => {
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            console.log("🚀 ===== APP WAS OPENED FROM NOTIFICATION =====");
            console.log("🚀 Timestamp:", new Date().toISOString());

            // Safely stringify response - may fail if it contains non-serializable objects
            try {
              console.log(
                "🚀 Last notification response:",
                JSON.stringify(response, null, 2)
              );
            } catch (stringifyError) {
              console.warn(
                "⚠️ Could not stringify response (contains non-serializable data)"
              );
            }

            // Prevent processing if already processing or modal is visible
            if (isProcessingNotification.current || isModalVisible) {
              console.log(
                "⚠️ Already processing notification or modal visible, ignoring last notification"
              );
              return;
            }

            // Show a toast to indicate app was opened from notification
            Toast.show(tn("openedFromNotification"), {
              type: "info",
              duration: 3000,
            });

            try {
              // Safely extract data from notification response
              // This may fail if the response contains non-serializable objects like UserHandle
              let data;
              try {
                data = response.notification.request.content.data;
                console.log("📦 Raw data from last notification:", data);
                console.log("📦 Data type:", typeof data);

                // Safely stringify data
                try {
                  console.log(
                    "📦 Extracted data:",
                    JSON.stringify(data, null, 2)
                  );
                } catch (stringifyError) {
                  console.warn(
                    "⚠️ Could not stringify data (may contain non-serializable properties)"
                  );
                }
              } catch (serializationError: any) {
                const errorMessage =
                  serializationError?.message || String(serializationError);
                if (
                  errorMessage.includes("UserHandle") ||
                  errorMessage.includes("Could not put") ||
                  errorMessage.includes("WritableMap")
                ) {
                  console.warn(
                    "⚠️ Notification response contains non-serializable data (UserHandle). This is a known Android issue."
                  );
                  console.warn(
                    "⚠️ Attempting to extract data using alternative method..."
                  );

                  // Try to access data directly from the notification object
                  try {
                    const notification = response.notification;
                    if (notification?.request?.content?.data) {
                      data = notification.request.content.data;
                    }
                  } catch (fallbackError) {
                    console.error(
                      "❌ Could not extract notification data:",
                      fallbackError
                    );
                    Toast.show(tn("processManual"), {
                      type: "warning",
                      duration: 5000,
                    });
                    return;
                  }
                } else {
                  throw serializationError;
                }
              }

              if (data) {
                // Delay to ensure app is fully loaded before showing modal
                console.log("🔄 Processing last notification data...");
                setTimeout(() => {
                  handleNotificationData(
                    data,
                    response.notification.request.identifier
                  );
                }, 1000);
              } else {
                console.error("❌ No data found in last notification");
                Toast.show(tn("foundNoData"), {
                  type: "warning",
                  duration: 3000,
                });
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error);
              console.error("❌ Error handling last notification:", error);
              console.error("❌ Error stack:", error.stack);

              // Don't show error toast for serialization errors - they're expected
              if (
                !errorMessage.includes("UserHandle") &&
                !errorMessage.includes("Could not put") &&
                !errorMessage.includes("WritableMap")
              ) {
                Toast.show(tn("errorLast", { message: errorMessage }), {
                  type: "danger",
                  duration: 5000,
                });
              }
            }
          } else {
            console.log("ℹ️ App opened normally (not from notification)");
          }
        })
        .catch((error: any) => {
          const errorMessage = error?.message || String(error);
          console.error("❌ Error checking last notification:", error);
          console.error("❌ Error stack:", error.stack);

          // Don't log as error for serialization issues - they're expected on Android
          if (
            errorMessage.includes("UserHandle") ||
            errorMessage.includes("Could not put") ||
            errorMessage.includes("WritableMap")
          ) {
            console.warn(
              "⚠️ Could not retrieve last notification response due to serialization issue. This is expected on Android."
            );
          } else {
            console.error(
              "❌ Unexpected error checking last notification:",
              error
            );
          }
        });
    }, 2000); // Delay 2 seconds to ensure app is fully initialized

    console.log("✅ Notification listeners set up successfully");
    console.log(
      "✅ Foreground listener:",
      foregroundSubscription ? "✅ Active" : "❌ Failed"
    );
    console.log(
      "✅ Response listener:",
      responseSubscription ? "✅ Active" : "❌ Failed"
    );

    return () => {
      console.log("🧹 Cleaning up notification listeners");
      if (foregroundSubscription) {
        Notifications.removeNotificationSubscription(foregroundSubscription);
      }
      if (responseSubscription) {
        Notifications.removeNotificationSubscription(responseSubscription);
      }
    };
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      const status: any = await AsyncStorage.getItem("status");
      const newIsOn = status === "active" ? true : false;
      console.log(
        `📋 Driver status loaded from storage: "${status}" -> isOn=${newIsOn}`
      );
      setIsOn(newIsOn);
      isOnRef.current = newIsOn; // Keep ref in sync with state
    };
    fetchStatus();
  }, []);

  // Keep ref in sync whenever isOn changes
  useEffect(() => {
    isOnRef.current = isOn;
    console.log(`🔄 isOn ref updated to: ${isOn}`);
  }, [isOn]);

  // Monitor AppState to handle foreground/background transitions
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        console.log(`📱 App state changed: ${nextAppState}`);

        if (nextAppState === "background" || nextAppState === "inactive") {
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "home.screen.tsx:855",
                message: "App moved to background",
                data: { nextAppState, isOn: isOnRef.current },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "D",
              }),
            }
          ).catch(() => {});
          // #endregion
          console.log(
            "📱 App moved to background - location tracking should continue if permissions are granted"
          );

          // Check if we have background permission
          const hasBackground = await hasBackgroundLocationPermission();
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "home.screen.tsx:862",
                message: "Background permission check",
                data: { hasBackground, isOn: isOnRef.current },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "D",
              }),
            }
          ).catch(() => {});
          // #endregion
          if (!hasBackground && isOnRef.current === true) {
            console.warn(
              "⚠️ App in background but background location permission not granted"
            );
            Toast.show(tn("backgroundPermissionShort"), {
              type: "warning",
              duration: 3000,
            });
          } else if (hasBackground && isOnRef.current === true) {
            console.log(
              "✅ Background location permission granted - tracking will continue managed by useLocationTracking hook"
            );
          }
        } else if (nextAppState === "active") {
          console.log("📱 App moved to foreground");

          // When app comes to foreground, verify permissions are still granted
          if (isOnRef.current === true) {
            const permissionStatus = await getLocationPermissionStatus();
            console.log(
              "📍 Permission status on foreground:",
              permissionStatus
            );

            if (!permissionStatus.background && Platform.OS === "android") {
              console.warn(
                "⚠️ Background location permission may have been revoked"
              );
            }
          }
        }
      }
    );

    return () => {
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

  // CRITICAL: Register for push notifications and save token
  // This must run:
  // 1. When component mounts (if driver is logged in)
  // 2. When driver data is loaded (to ensure accessToken is available)
  // 3. When app comes to foreground (to refresh token and ensure it's valid)
  useEffect(() => {
    let isMounted = true;
    let appStateSubscription: any = null;

    // Only register if driver is logged in (has accessToken)
    const checkAndRegister = async () => {
      if (!isMounted) return;

      // Guard: Prevent concurrent registrations
      if (isRegisteringToken.current) {
        console.log("⚠️ Token registration already in progress, skipping...");
        return;
      }

      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        if (accessToken) {
          console.log(
            "🔑 Driver is logged in - registering for push notifications..."
          );
          await registerForPushNotificationsAsync();
        } else {
          console.warn(
            "⚠️ Driver not logged in - skipping push notification registration"
          );
        }
      } catch (error) {
        console.error("❌ Error checking access token:", error);
      }
    };

    // Only register if driver ID exists (not just when driver object changes)
    if (driver?.id) {
      // Register immediately when driver data is loaded
      // The token comparison inside registerForPushNotificationsAsync will prevent duplicate saves
      checkAndRegister();
    }

    // Also register when app comes to foreground to ensure token is fresh and valid
    // Add debouncing to prevent rapid successive calls
    appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active" && isMounted) {
          // Clear any pending timeout
          if (appStateRegistrationTimeout.current) {
            clearTimeout(appStateRegistrationTimeout.current);
          }

          // Debounce: Wait 1 second before checking (prevents rapid triggers)
          appStateRegistrationTimeout.current = setTimeout(() => {
            if (isMounted && !isRegisteringToken.current) {
              console.log("📱 App came to foreground - checking push token...");
              checkAndRegister();
            }
          }, 1000);
        }
      }
    );

    return () => {
      isMounted = false;
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
      if (appStateRegistrationTimeout.current) {
        clearTimeout(appStateRegistrationTimeout.current);
      }
    };
  }, [driver?.id]); // Only re-run when driver ID changes (not on every object reference change)

  // CRITICAL: Register for push notifications and get fresh token
  // This function generates a NEW token every time it's called
  // Expo push tokens are stable but we should refresh on app launch to ensure validity
  async function registerForPushNotificationsAsync() {
    // Early return guard: Prevent concurrent registrations
    if (isRegisteringToken.current) {
      console.log(
        "⚠️ Token registration already in progress, skipping duplicate call..."
      );
      return;
    }

    // Set registration in progress flag
    isRegisteringToken.current = true;

    try {
      console.log("🔔 ===== STARTING PUSH NOTIFICATION REGISTRATION =====");
      console.log("🔔 Timestamp:", new Date().toISOString());

      if (!isPhysicalDevice()) {
        console.warn(
          "⚠️ Not a physical device - push notifications not available"
        );
        Toast.show(tn("physicalDeviceRequired"), {
          type: "danger",
        });
        isRegisteringToken.current = false;
        return;
      }

      // Step 1: Request/check notification permissions
      console.log("📋 Step 1: Checking notification permissions...");
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        console.log("📋 Requesting notification permissions...");
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.error("❌ Notification permissions not granted:", finalStatus);
        Toast.show(tn("pushTokenFailed"), {
          type: "danger",
        });
        isRegisteringToken.current = false;
        return;
      }

      console.log("✅ Notification permissions granted");

      // Step 2: Get project ID
      console.log("📋 Step 2: Getting project ID...");
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) {
        console.error("❌ Project ID not found for push notifications");
        console.error("❌ expoConfig:", Constants?.expoConfig);
        console.error("❌ easConfig:", Constants?.easConfig);
        Toast.show(tn("projectIdFailed"), {
          type: "danger",
        });
        isRegisteringToken.current = false;
        return;
      }

      console.log("✅ Project ID found:", projectId);

      // Step 3: Get Expo push token (this generates a fresh token)
      console.log("📋 Step 3: Getting Expo push token...");
      console.log("📋 This will generate a NEW token if needed...");

      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      if (!pushTokenString) {
        console.error("❌ Failed to get push token - token is null/undefined");
        Toast.show(tn("getPushTokenFailed"), {
          type: "danger",
        });
        isRegisteringToken.current = false;
        return;
      }

      // Validate token format
      if (!pushTokenString.startsWith("ExponentPushToken[")) {
        console.error("❌ Invalid push token format:", pushTokenString);
        Toast.show(tn("invalidPushToken"), {
          type: "danger",
        });
        isRegisteringToken.current = false;
        return;
      }

      console.log("✅ ===== PUSH TOKEN OBTAINED SUCCESSFULLY =====");
      console.log("✅ Token:", pushTokenString);
      console.log("✅ Token format: Valid");
      console.log("✅ Project ID:", projectId);
      console.log("✅ Device is device:", isPhysicalDevice());
      console.log("✅ Platform:", Platform.OS);
      console.log("✅ Timestamp:", new Date().toISOString());

      // Early return guard: Check if this token was already saved
      if (lastSavedToken.current === pushTokenString) {
        console.log(
          "✅ Token already saved previously, skipping save operation..."
        );
        console.log("✅ Token:", pushTokenString);
        tokenRegistrationCompleted.current = true;
        isRegisteringToken.current = false;
        return;
      }

      // CRITICAL: Save notification token to database
      // This token must match what's in the database for notifications to work
      // We need to wait for accessToken to be available
      const saveTokenToDatabase = async (retries = 10) => {
        console.log("💾 Starting token save process...");

        for (let i = 0; i < retries; i++) {
          try {
            console.log(
              `🔄 Attempting to save token (attempt ${i + 1}/${retries})...`
            );

            // Wait a bit longer on first few attempts to ensure driver is logged in
            if (i > 0) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            const accessToken = await AsyncStorage.getItem("accessToken");

            if (!accessToken) {
              console.warn(`⚠️ Access token not available (attempt ${i + 1})`);
              console.warn(
                `⚠️ Driver may not be logged in yet - will retry...`
              );
              if (i < retries - 1) {
                continue;
              } else {
                console.error(
                  "❌ Failed to save token: No access token after all retries"
                );
                console.error(
                  "❌ Driver must be logged in to save notification token"
                );
                console.error(
                  "❌ Token will be saved automatically when driver logs in"
                );
                Toast.show(tn("loginToEnablePush"), {
                  type: "warning",
                  duration: 3000,
                });
                return;
              }
            }

            if (!pushTokenString) {
              console.error("❌ Failed to save token: No push token");
              return;
            }

            console.log("📤 Sending token to server...");
            console.log("📤 Token:", pushTokenString);
            console.log(
              "📤 Server URL:",
              `${getServerUri()}/driver/update-notification-token`
            );

            const response = await axios.put(
              `${getServerUri()}/driver/update-notification-token`,
              {
                notificationToken: pushTokenString,
              },
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
                timeout: 10000, // 10 second timeout
              }
            );

            console.log("✅ ===== NOTIFICATION TOKEN SAVED SUCCESSFULLY =====");
            console.log("✅ Saved token:", pushTokenString);
            console.log(
              "✅ Server response:",
              JSON.stringify(response.data, null, 2)
            );
            console.log(
              "✅ Token in database:",
              response.data?.driver?.notificationToken
            );

            // Verify token matches
            if (response.data?.driver?.notificationToken === pushTokenString) {
              console.log(
                "✅ Token verification: MATCH - notifications should work!"
              );

              // Only show toast if this is a new token (not already saved)
              const isNewToken = lastSavedToken.current !== pushTokenString;
              if (isNewToken) {
                Toast.show(tn("pushEnabled"), {
                  type: "success",
                  duration: 2000,
                });
              }

              // Update tracking refs
              lastSavedToken.current = pushTokenString;
              tokenRegistrationCompleted.current = true;
            } else {
              console.error("❌ Token verification: MISMATCH!");
              console.error("❌ Expected:", pushTokenString);
              console.error(
                "❌ Got:",
                response.data?.driver?.notificationToken
              );
              console.error("❌ This will cause notifications to fail!");
            }

            return; // Success, exit function
          } catch (error: any) {
            console.error(
              `❌ Error saving notification token (attempt ${i + 1}):`,
              error.message
            );
            console.error("❌ Error response:", error.response?.data);
            console.error("❌ Error status:", error.response?.status);
            console.error("❌ Error code:", error.code);

            // Check if it's a network error
            if (
              error.code === "ECONNABORTED" ||
              error.message.includes("timeout")
            ) {
              console.warn("⚠️ Request timeout - network may be slow");
            } else if (error.response?.status === 401) {
              console.error("❌ Unauthorized - access token may be invalid");
              console.error("❌ Driver may need to log in again");
              Toast.show(tn("loginAgainNotifications"), {
                type: "warning",
                duration: 3000,
              });
              return; // Don't retry if unauthorized
            } else if (error.response?.status >= 500) {
              console.warn("⚠️ Server error - will retry");
            }

            if (i < retries - 1) {
              console.log(`⏳ Waiting ${2 * (i + 1)} seconds before retry...`);
              await new Promise((resolve) =>
                setTimeout(resolve, 2000 * (i + 1))
              );
            } else {
              console.error(
                "❌ Failed to save notification token after all retries"
              );
              console.error(
                "❌ Notifications will NOT work until token is saved!"
              );
              console.error("❌ Possible causes:");
              console.error("   1. Driver is not logged in");
              console.error("   2. Network connection issue");
              console.error("   3. Server is down");
              console.error("   4. Access token is invalid");
              Toast.show(tn("tokenSaveFailed"), {
                type: "warning",
                duration: 5000,
              });
            }
          }
        }
      };

      // Save token to database and wait for completion
      // This ensures the registration flag is only reset after save completes
      await saveTokenToDatabase().catch((err) => {
        console.error("❌ Unexpected error in token save process:", err);
        console.error("❌ Error stack:", err.stack);
      });
    } catch (e: any) {
      console.error("Error getting push token:", e);

      // Check if it's a Firebase initialization error
      const errorMessage = e?.message || String(e);
      const isFirebaseError =
        errorMessage.includes("FirebaseApp") ||
        errorMessage.includes("Firebase");

      if (isFirebaseError) {
        console.warn("Firebase not initialized. This usually happens when:");
        console.warn(
          "1. The app needs to be rebuilt with expo-notifications plugin"
        );
        console.warn(
          "2. Run: npx expo prebuild --clean (if using bare workflow)"
        );
        console.warn("3. Or rebuild the app with: npx expo run:android");
        console.warn(
          "4. Push notifications will work after rebuilding the app"
        );

        // Don't show error to user - this is a configuration issue that needs a rebuild
        // The app can still function without push notifications
      } else if (isPhysicalDevice()) {
        // Only show other errors on real devices
        Toast.show(tn("pushUnavailableRebuild"), {
          type: "warning",
          duration: 3000,
        });
      }
    } finally {
      // Always reset the registration flag, even if there was an error
      isRegisteringToken.current = false;
    }

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
  }

  // Helper function to start ping keep-alive (shared across useEffects)
  const startPingKeepAlive = useCallback(() => {
    // Clear any existing ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    // Send ping every 30 seconds to keep connection alive
    pingIntervalRef.current = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        try {
          // Send JSON ping message (React Native WebSocket doesn't expose ping() method)
          ws.current.send(JSON.stringify({ type: "ping" }));
          console.log("🏓 [WebSocket] Sent ping to keep connection alive");
        } catch (error) {
          console.error("❌ [WebSocket] Error sending ping:", error);
        }
      } else {
        // WebSocket not open, clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
      }
    }, 30000); // 30 seconds
  }, []);

  // Helper function to stop ping keep-alive (shared across useEffects)
  const stopPingKeepAlive = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // socket updates with automatic reconnection
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    const maxReconnectAttempts = 10;
    const reconnectDelay = 3000; // 3 seconds

    const connectWebSocket = () => {
      const wsUrl = getWebSocketUrl();
      console.log(
        `🔌 [WebSocket] Attempting to connect to WebSocket: ${wsUrl} (Attempt ${
          wsReconnectAttemptsRef.current + 1
        })`
      );
      console.log(`🔌 [WebSocket] Full connection details:`, {
        url: wsUrl,
        platform: Platform.OS,
        isOn: isOnRef.current,
        hasCurrentLocation: !!currentLocation,
      });

      try {
        ws.current = new WebSocket(wsUrl);
        console.log(
          `🔌 [WebSocket] WebSocket object created, readyState: ${ws.current?.readyState}`
        );

        ws.current.onopen = () => {
          console.log(
            "✅ [WebSocket] Connected to WebSocket server successfully"
          );
          console.log("✅ [WebSocket] URL:", wsUrl);
          console.log("✅ [WebSocket] Driver status (isOn):", isOnRef.current);
          console.log("✅ [WebSocket] ReadyState:", ws.current?.readyState);
          setWsConnected(true);
          wsReconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
          // Set WebSocket connection for background task
          setWebSocketConnection(ws.current);

          // Start ping keep-alive mechanism
          startPingKeepAlive();

          // If driver is already active and we have a location, send it immediately
          if (isOnRef.current && currentLocation) {
            console.log(
              "✅ [WebSocket] Driver is active and has location - sending immediately"
            );
            sendLocationUpdateWithRetry(currentLocation).then((success) => {
              if (success) {
                console.log(
                  "✅ [WebSocket] Initial location sent after connection"
                );
              } else {
                console.warn(
                  "⚠️ [WebSocket] Failed to send initial location after connection"
                );
              }
            });
          }
        };

        ws.current.onmessage = (e) => {
          try {
            // Check if this is a binary message (ping/pong)
            if (typeof e.data === "string") {
              const message = JSON.parse(e.data);

              // Handle pong response for keep-alive
              if (message.type === "pong") {
                console.log(
                  "🏓 [WebSocket] Received pong - connection is alive"
                );
                return;
              }

              console.log(
                "📨 [WebSocket] Received message:",
                message.type || "unknown"
              );
              // Handle received location updates here
            } else {
              // Binary data - likely a ping/pong frame
              // React Native WebSocket automatically handles ping/pong
              console.log("🏓 [WebSocket] Received ping/pong frame");
            }
          } catch (error) {
            console.error("❌ [WebSocket] Error parsing message:", error);
          }
        };

        ws.current.onerror = (e: any) => {
          const errorMsg = e.message || e.toString() || "Unknown error";
          console.error(`❌ [WebSocket] Connection error: ${errorMsg}`);
          console.error(`❌ [WebSocket] Error type:`, typeof e);
          console.error(`❌ [WebSocket] Error object:`, e);
          console.error(
            `❌ [WebSocket] Current readyState:`,
            ws.current?.readyState
          );
          console.error(`❌ [WebSocket] Attempted URL: ${wsUrl}`);
          setWsConnected(false);

          // Don't immediately reconnect on error - wait for close event
          // The close event will handle reconnection logic
        };

        ws.current.onclose = (e) => {
          const wasClean = e.wasClean !== undefined ? e.wasClean : false;
          console.log(
            `🔌 [WebSocket] Connection closed: code=${e.code}, reason="${
              e.reason || "No reason provided"
            }", wasClean=${wasClean}`
          );
          console.log(`🔌 [WebSocket] Close event details:`, {
            code: e.code,
            reason: e.reason,
            wasClean,
            url: wsUrl,
            readyState: ws.current?.readyState,
            isComponentUnmounting: isComponentUnmountingRef.current,
          });

          // Stop ping keep-alive when connection closes
          stopPingKeepAlive();

          // Common close codes:
          // 1000 = Normal closure
          // 1001 = Going away
          // 1006 = Abnormal closure (no close frame received)
          // 1002 = Protocol error
          // 1003 = Unsupported data
          // 1005 = No status code
          // 1007 = Invalid frame payload data
          // 1008 = Policy violation
          // 1009 = Message too big
          // 1011 = Internal server error

          // Handle code 1006 (abnormal closure) - this is expected when app goes to background
          if (e.code === 1006) {
            console.log(
              `ℹ️ [WebSocket] Abnormal closure (code 1006) - expected when app goes to background`
            );
            console.log(
              `ℹ️ [WebSocket] Connection will be restored when app comes to foreground`
            );
            console.log(
              `ℹ️ [WebSocket] Location updates continue via HTTP API in background`
            );
            // Don't attempt to reconnect in background - wait for app to return to foreground
            // The AppState handler will reconnect when app becomes active
            setWsConnected(false);
            return;
          }

          setWsConnected(false);

          // Only attempt to reconnect if component is not unmounting
          // If component is unmounting, don't reconnect (cleanup will handle it)
          if (isComponentUnmountingRef.current) {
            console.log(
              "ℹ️ [WebSocket] Component unmounting - not attempting reconnection"
            );
            return;
          }

          // Only reconnect if app is in foreground (active state)
          // Code 1006 is handled above and doesn't reconnect
          // Code 1000 (normal closure) or 1001 (going away) typically shouldn't reconnect
          const isAppActive =
            require("react-native").AppState.currentState === "active";
          const shouldReconnect =
            isAppActive &&
            !wasClean &&
            e.code !== 1000 &&
            e.code !== 1001 &&
            e.code !== 1006 && // Don't reconnect for 1006 - handled separately
            wsReconnectAttemptsRef.current < maxReconnectAttempts;

          if (shouldReconnect) {
            wsReconnectAttemptsRef.current++;
            console.log(
              `🔄 Will attempt to reconnect in ${
                reconnectDelay / 1000
              } seconds... (${
                wsReconnectAttemptsRef.current
              }/${maxReconnectAttempts})`
            );

            reconnectTimeout = setTimeout(() => {
              // Check again if component is still mounted before reconnecting
              if (!isComponentUnmountingRef.current) {
                console.log(
                  `🔄 Attempting reconnection ${wsReconnectAttemptsRef.current}/${maxReconnectAttempts}...`
                );
                connectWebSocket();
              }
            }, reconnectDelay);
          } else if (wsReconnectAttemptsRef.current >= maxReconnectAttempts) {
            console.error(
              `❌ Max reconnection attempts (${maxReconnectAttempts}) reached. Please check WebSocket server.`
            );
            console.error(
              `   Last close code: ${e.code}, wasClean: ${wasClean}`
            );
          } else if (wasClean) {
            console.log(
              `ℹ️ Connection closed cleanly (code ${e.code}). Not reconnecting.`
            );
          }
        };
      } catch (error: any) {
        console.error("❌ Failed to create WebSocket:", error);
        setWsConnected(false);

        // Retry connection
        if (
          wsReconnectAttemptsRef.current < maxReconnectAttempts &&
          !isComponentUnmountingRef.current
        ) {
          wsReconnectAttemptsRef.current++;
          reconnectTimeout = setTimeout(() => {
            if (!isComponentUnmountingRef.current) {
              connectWebSocket();
            }
          }, reconnectDelay);
        }
      }
    };

    // Initial connection
    connectWebSocket();

    return () => {
      // Mark component as unmounting to prevent reconnections
      isComponentUnmountingRef.current = true;

      // Stop ping keep-alive
      stopPingKeepAlive();

      // Clear reconnection timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      // Only cleanup WebSocket if component is actually unmounting
      // Don't cleanup when app goes to background - preserve connection
      if (ws.current) {
        console.log(
          "🧹 [WebSocket] Cleaning up WebSocket connection (component unmounting)"
        );
        setWebSocketConnection(null); // Clear WebSocket from background task
        ws.current.close();
        ws.current = null;
      }
    };
  }, []);

  // AppState monitoring for WebSocket reconnection
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log(`📱 [WebSocket] App state changed to: ${nextAppState}`);

      if (nextAppState === "background" || nextAppState === "inactive") {
        // App went to background - WebSocket will disconnect (code=1006) which is normal
        // Don't attempt to keep it alive or reconnect - HTTP API will handle location updates
        console.log(
          "📱 [WebSocket] App moved to background - WebSocket disconnection expected (code=1006 is normal)"
        );
        console.log(
          "📱 [WebSocket] Location updates will continue via HTTP API in background"
        );
        // Note: WebSocket will disconnect when app backgrounds - this is expected behavior
        // The background location task uses HTTP API, so location updates continue
      } else if (nextAppState === "active") {
        // App came to foreground - check WebSocket state and reconnect if needed
        console.log(
          "📱 [WebSocket] App moved to foreground - checking WebSocket connection"
        );

        // Check if WebSocket is connected
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
          console.log(
            "🔄 [WebSocket] WebSocket not connected - attempting immediate reconnection"
          );

          // Reset reconnection attempts when app comes to foreground
          wsReconnectAttemptsRef.current = 0;

          // Attempt immediate reconnection
          if (ws.current) {
            // Close existing connection if it exists but isn't open
            try {
              ws.current.close();
            } catch (error) {
              console.error(
                "❌ [WebSocket] Error closing existing connection:",
                error
              );
            }
            ws.current = null;
          }

          // Reconnect immediately
          const wsUrl = getWebSocketUrl();
          try {
            console.log(`🔄 [WebSocket] Reconnecting to: ${wsUrl}`);
            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => {
              console.log(
                "✅ [WebSocket] Reconnected successfully after app came to foreground"
              );
              setWsConnected(true);
              wsReconnectAttemptsRef.current = 0;
              // Set WebSocket connection for background task
              setWebSocketConnection(ws.current);

              // Start ping keep-alive mechanism
              startPingKeepAlive();

              // If driver is active and we have a location, send it immediately
              if (isOnRef.current && currentLocation) {
                console.log(
                  "✅ [WebSocket] Driver is active - sending location after reconnection"
                );
                sendLocationUpdateWithRetry(currentLocation).then((success) => {
                  if (success) {
                    console.log(
                      "✅ [WebSocket] Location sent after reconnection"
                    );
                  }
                });
              }
            };

            ws.current.onmessage = (e) => {
              try {
                if (typeof e.data === "string") {
                  const message = JSON.parse(e.data);
                  if (message.type === "pong") {
                    console.log(
                      "🏓 [WebSocket] Received pong - connection is alive"
                    );
                    return;
                  }
                }
              } catch (error) {
                // Ignore parse errors
              }
            };

            ws.current.onerror = (e: any) => {
              console.error("❌ [WebSocket] Reconnection error:", e);
              setWsConnected(false);
            };

            ws.current.onclose = (e) => {
              console.log(`🔌 [WebSocket] Reconnection closed: code=${e.code}`);
              setWsConnected(false);

              // Stop ping keep-alive
              stopPingKeepAlive();

              // Attempt to reconnect again if not unmounting
              if (
                !isComponentUnmountingRef.current &&
                wsReconnectAttemptsRef.current < 10
              ) {
                wsReconnectAttemptsRef.current++;
                setTimeout(() => {
                  if (!isComponentUnmountingRef.current) {
                    handleAppStateChange("active"); // Retry reconnection
                  }
                }, 3000);
              }
            };
          } catch (error: any) {
            console.error("❌ [WebSocket] Failed to reconnect:", error);
            setWsConnected(false);
          }
        } else {
          console.log(
            "✅ [WebSocket] WebSocket already connected - no action needed"
          );
        }
      }
    };

    // Subscribe to AppState changes
    wsAppStateSubscriptionRef.current = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      // Cleanup AppState subscription
      if (wsAppStateSubscriptionRef.current) {
        wsAppStateSubscriptionRef.current.remove();
        wsAppStateSubscriptionRef.current = null;
      }
    };
  }, [currentLocation, startPingKeepAlive, stopPingKeepAlive]);

  // WebSocket callback for useLocationTracking hook
  // This function sends location updates via WebSocket when hook receives location
  const sendLocationToWebSocket = useCallback(
    (
      location: { latitude: number; longitude: number; heading?: number },
      driverData: any
    ) => {
      // Check if WebSocket is connected
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        console.log(
          "⚠️ [sendLocationToWebSocket] WebSocket not connected - location update will be sent via HTTP API by useLocationTracking hook instead"
        );
        // Note: The useLocationTracking hook will send via HTTP API when WebSocket is unavailable
        // This ensures location updates continue even when app is in background
        return;
      }

      const driverStatus = driverData.status || "active";

      // Send WebSocket message
      const message = JSON.stringify({
        type: "locationUpdate",
        data: {
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading !== undefined ? location.heading : null,
          name: driverData.name || "Driver",
          status: driverStatus,
          vehicleType: driverData.vehicle_type || "Car",
        },
        role: "driver",
        driver: driverData.id,
      });

      try {
        ws.current.send(message);
        console.log(
          "✅ [sendLocationToWebSocket] Location update sent via WebSocket (foreground mode)",
          {
            driverId: driverData.id,
            location: { lat: location.latitude, lng: location.longitude },
            heading: location.heading ?? null,
          }
        );
      } catch (error: any) {
        console.error(
          "❌ [sendLocationToWebSocket] Error sending WebSocket message:",
          error
        );
      }
    },
    []
  );

  // Use useLocationTracking hook for continuous location updates
  // This replaces the custom location tracking implementation
  const {
    currentLocation: trackedLocation,
    lastSentLocation,
    isTracking,
    error: trackingError,
    startTracking,
    stopTracking,
  } = useLocationTracking({
    isActive: isOn === true,
    onLocationUpdate: useCallback((location) => {
      // Update local state for UI
      setCurrentLocation(location);
    }, []),
    sendToServer: true, // Hook handles HTTP API calls for scheduled trips
    sendToWebSocket: sendLocationToWebSocket, // Custom WebSocket callback
    distanceThreshold: 200, // Same as previous implementation
  });

  // Sync tracked location with local state
  useEffect(() => {
    if (trackedLocation) {
      setCurrentLocation(trackedLocation);
    }
  }, [trackedLocation]);

  // Memoize haversine distance calculation to avoid recreating function on every render
  const haversineDistance = useCallback((coords1: any, coords2: any) => {
    const toRad = (x: any) => (x * Math.PI) / 180;

    const R = 6371e3; // Radius of the Earth in meters
    const lat1 = toRad(coords1.latitude);
    const lat2 = toRad(coords2.latitude);
    const deltaLat = toRad(coords2.latitude - coords1.latitude);
    const deltaLon = toRad(coords2.longitude - coords1.longitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters
    return distance;
  }, []);

  // Retry mechanism for sending location updates
  const sendLocationUpdateWithRetry = async (
    location: any,
    retryCount = 0,
    maxRetries = 3
  ) => {
    const currentIsOn = isOnRef.current;
    if (!currentIsOn) {
      console.log(
        `⚠️ [sendLocationUpdateWithRetry] Driver is inactive - skipping location update`
      );
      return false;
    }

    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      if (retryCount < maxRetries) {
        console.log(
          `⚠️ [sendLocationUpdateWithRetry] WebSocket not ready, retrying in 1 second... (${
            retryCount + 1
          }/${maxRetries})`
        );
        setTimeout(() => {
          sendLocationUpdateWithRetry(location, retryCount + 1, maxRetries);
        }, 1000);
        return false;
      } else {
        console.log(
          "⚠️ [sendLocationUpdateWithRetry] WebSocket not connected after max retries - cannot send location update"
        );
        return false;
      }
    }

    return await sendLocationUpdate(location);
  };

  const sendLocationUpdate = async (location: any) => {
    console.log("📍 [sendLocationUpdate] Starting location update process");
    console.log("📍 [sendLocationUpdate] Location:", {
      lat: location.latitude,
      lng: location.longitude,
      heading: location.heading,
    });

    // Only send location updates if driver is active (use ref to get latest value)
    const currentIsOn = isOnRef.current;
    console.log(
      "📍 [sendLocationUpdate] Driver status check - isOn:",
      currentIsOn
    );
    if (!currentIsOn) {
      console.log(
        `⚠️ [sendLocationUpdate] Driver is inactive (isOn=${currentIsOn}) - skipping location update`
      );
      return false;
    }

    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.log(
        "⚠️ [sendLocationUpdate] WebSocket not connected - cannot send location update"
      );
      console.log(
        "⚠️ [sendLocationUpdate] WebSocket state:",
        ws.current ? ws.current.readyState : "null"
      );
      return false;
    }
    console.log("✅ [sendLocationUpdate] WebSocket is connected and ready");

    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      console.error(
        "❌ [sendLocationUpdate] No access token - cannot fetch driver data"
      );
      return;
    }
    console.log("✅ [sendLocationUpdate] Access token found");

    console.log(
      "📡 [sendLocationUpdate] Fetching driver data from:",
      `${getServerUri()}/driver/me`
    );
    await axios
      .get(`${getServerUri()}/driver/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      .then((res) => {
        if (res.data && res.data.driver) {
          const driverData = res.data.driver;
          const driverStatus = driverData.status || "active";
          console.log("✅ [sendLocationUpdate] Driver data fetched:", {
            id: driverData.id,
            name: driverData.name,
            status: driverStatus,
            vehicleType: driverData.vehicle_type,
          });

          const message = JSON.stringify({
            type: "locationUpdate",
            data: {
              latitude: location.latitude,
              longitude: location.longitude,
              heading: location.heading !== undefined ? location.heading : null,
              name: driverData.name || "Driver",
              status: driverStatus,
              vehicleType: driverData.vehicle_type || "Car",
            },
            role: "driver",
            driver: driverData.id,
          });

          console.log(
            "📤 [sendLocationUpdate] Sending location update via WebSocket:",
            {
              type: "locationUpdate",
              driverId: driverData.id,
              location: { lat: location.latitude, lng: location.longitude },
              status: driverStatus,
            }
          );

          if (ws.current) {
            ws.current.send(message);
            console.log(
              "✅ [sendLocationUpdate] Location update sent successfully via WebSocket"
            );
          }

          // Also update location for scheduled trips (only if driver is online)
          // The backend will check if driver is online, so we can safely call this
          axios
            .post(
              `${getServerUri()}/driver/update-location`,
              {
                latitude: location.latitude,
                longitude: location.longitude,
              },
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            )
            .then((res) => {
              if (res.data.success && res.data.activationChecks) {
                // Check if any trips became available
                const availableTrips = res.data.activationChecks.filter(
                  (check: any) => check.canActivate
                );
                if (availableTrips.length > 0) {
                  console.log(
                    `✅ [sendLocationUpdate] ${availableTrips.length} trip(s) are now available to start`
                  );
                  // Notification will be sent by the backend
                }
              }
            })
            .catch((error: any) => {
              // Non-critical error - might be because driver is offline
              if (
                error.response?.status === 400 &&
                error.response?.data?.message?.includes("online")
              ) {
                console.log(
                  "⚠️ [sendLocationUpdate] Location update skipped - driver is offline"
                );
              } else {
                console.log(
                  "⚠️ [sendLocationUpdate] Failed to update location for scheduled trips:",
                  error.message
                );
              }
            });

          return true;
        } else {
          console.error("❌ [sendLocationUpdate] No driver data in response");
          return false;
        }
      })
      .catch((error) => {
        console.error(
          "❌ [sendLocationUpdate] Error fetching driver data:",
          error
        );
        return false;
      });

    return false;
  };

  // Memoize handleClose to prevent unnecessary re-renders
  const handleClose = useCallback(() => {
    setIsModalVisible(false);
    // Reset processing flag when modal is closed
    isProcessingNotification.current = false;
  }, []);

  // Enhanced status change handler with retry logic and confirmation
  const handleStatusChange = useCallback(async () => {
    if (loading) {
      return; // Prevent concurrent status changes
    }

    // Show confirmation modal when going offline
    if (isOn) {
      setShowOfflineConfirmation(true);
      return;
    }

    // Proceed with going online
    await performStatusChange("active");
  }, [loading, isOn, performStatusChange]);

  // Actual status change implementation with retry logic
  const performStatusChange = useCallback(
    async (targetStatus: "active" | "inactive", retryCount = 0) => {
      const maxRetries = 3;
      const retryDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff

      if (loading && retryCount === 0) {
        return; // Prevent concurrent status changes
      }

      console.log(
        `🔄 [performStatusChange] Attempting status change to: ${targetStatus} (attempt ${
          retryCount + 1
        }/${maxRetries + 1})`
      );

      // Optimistic UI update
      const previousIsOn = isOn;
      const optimisticIsOn = targetStatus === "active";
      if (retryCount === 0) {
        setIsOn(optimisticIsOn);
        isOnRef.current = optimisticIsOn;
        setloading(true);
      }

      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        if (!accessToken) {
          throw new Error("No access token available");
        }

        // Check WebSocket connection when going online
        if (targetStatus === "active" && !wsConnected) {
          console.warn(
            "⚠️ WebSocket not connected - status may not sync properly"
          );
          Toast.show(tn("connectionIssue"), {
            type: "warning",
            duration: 3000,
          });
        }

        const response = await axios.put(
          `${getServerUri()}/driver/update-status`,
          {
            status: targetStatus,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            timeout: 10000, // 10 second timeout
          }
        );

        if (response.data && response.data.driver) {
          console.log(
            "✅ [performStatusChange] Status updated successfully:",
            response.data.driver.status
          );
          const newIsOn = response.data.driver.status === "active";
          setIsOn(newIsOn);
          isOnRef.current = newIsOn;
          await AsyncStorage.setItem("status", response.data.driver.status);
          revalidateDashboardData();

          Toast.show(
            targetStatus === "active" ? t("youAreNowOnline") : t("youAreNowOffline"),
            {
              type: "success",
              duration: 2000,
            }
          );

          // Handle location tracking based on status
          if (targetStatus === "active") {
            // Driver going active - start foreground service and prompt for battery optimization
            try {
              // Check if we have background permission
              const hasBackground = await hasBackgroundLocationPermission();
              if (!hasBackground) {
                console.warn("⚠️ Background location permission not granted");
                Toast.show(tn("backgroundLocationWarn"), {
                  type: "warning",
                  duration: 4000,
                });
              }

              // Start foreground service for background location tracking
              console.log(
                "✅ Starting location tracking with foreground service"
              );

              // Prompt user to disable battery optimization (only once, can be skipped)
              const batteryOptPromptShown = await AsyncStorage.getItem(
                "batteryOptPromptShown"
              );
              if (!batteryOptPromptShown && Platform.OS === "android") {
                setTimeout(() => {
                  promptDisableBatteryOptimization();
                  AsyncStorage.setItem("batteryOptPromptShown", "true");
                }, 2000);
              }

              // Send current location immediately with retry logic
              if (currentLocation) {
                console.log("✅ Attempting to send location update with retry");
                sendLocationUpdateWithRetry(currentLocation).then((success) => {
                  if (success) {
                    console.log("✅ Location update sent successfully");
                  } else {
                    console.log(
                      "⚠️ Location update will be retried automatically"
                    );
                  }
                });
              } else {
                console.log("⚠️ No current location available yet");
              }
            } catch (error) {
              console.error("Error starting location tracking:", error);
            }
          } else {
            // Driver going inactive - stop foreground service
            console.log("🛑 Stopping location tracking");

            // Notify socket server when driver goes inactive
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              const message = JSON.stringify({
                type: "driverStatusChange",
                role: "driver",
                driver: response.data.driver.id,
                status: "inactive",
              });
              ws.current.send(message);
            }
          }

          setloading(false);
        } else {
          throw new Error("Invalid response from server");
        }
      } catch (error: any) {
        console.error(
          `❌ [performStatusChange] Error (attempt ${retryCount + 1}):`,
          error
        );

        // Rollback optimistic update on first failure
        if (retryCount === 0) {
          setIsOn(previousIsOn);
          isOnRef.current = previousIsOn;
        }

        // Retry logic
        if (retryCount < maxRetries) {
          const isNetworkError =
            error.code === "ECONNABORTED" ||
            error.code === "ERR_NETWORK" ||
            error.message?.includes("timeout") ||
            error.message?.includes("Network");

          if (isNetworkError || error.response?.status >= 500) {
            console.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
            setTimeout(() => {
              performStatusChange(targetStatus, retryCount + 1);
            }, retryDelay);
            return;
          }
        }

        // All retries failed or non-retryable error
        setloading(false);
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          tn("statusUpdateFailed");

        Toast.show(errorMessage, {
          type: "danger",
          duration: 4000,
        });
      }
    },
    [loading, isOn, currentLocation, wsConnected, revalidateDashboardData, t, tn]
  );

  // Confirm going offline
  const confirmGoOffline = useCallback(() => {
    setShowOfflineConfirmation(false);
    performStatusChange("inactive");
  }, [performStatusChange]);

  // Cancel going offline
  const cancelGoOffline = useCallback(() => {
    setShowOfflineConfirmation(false);
  }, []);

  const sendPushNotification = async (expoPushToken: string, data: any) => {
    const message = {
      to: expoPushToken,
      sound: "default",
      title: t("rideRequestAcceptedTitle"),
      body: t("rideRequestAcceptedBody"),
      data: { orderData: data },
    };
    await axios
      .post("https://exp.host/--/api/v2/push/send", message)
      .catch((error) => {
        console.log(error);
      });
  };

  // Memoize acceptRideHandler to prevent unnecessary re-renders
  const acceptRideHandler = useCallback(async () => {
    // Prevent multiple accept clicks
    if (loading) {
      console.log("⚠️ Already processing ride acceptance, ignoring duplicate");
      return;
    }

    setloading(true);
    const accessToken = await AsyncStorage.getItem("accessToken");

    try {
      const res = await axios.post(
        `${getServerUri()}/driver/new-ride`,
        {
          userId: userData?.id!,
          charge: (distance * parseInt(driver?.rate!)).toFixed(2),
          status: "Processing",
          currentLocationName,
          destinationLocationName,
          distance,
          // Send location data so socket server can notify user
          currentLocation,
          marker,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // Close modal and reset processing immediately after accepting
      setIsModalVisible(false);
      isProcessingNotification.current = false;

      // Get user's notification token from the order data
      // Note: userData should contain the user's notificationToken
      if (userData?.notificationToken) {
        const data = {
          ...driver,
          currentLocation,
          marker,
          distance,
        };
        await sendPushNotification(userData.notificationToken, data);
      }

      const rideData = {
        user: userData,
        currentLocation,
        marker,
        driver,
        distance,
        rideData: res.data.newRide,
      };
      router.push({
        pathname: "/(routes)/ride-details",
        params: { orderData: JSON.stringify(rideData) },
      });
    } catch (error: any) {
      console.error("Error accepting ride:", error);
      Toast.show(tn("acceptRideFailed"), {
        type: "danger",
        duration: 3000,
      });
    } finally {
      setloading(false);
    }
  }, [
    loading,
    userData,
    distance,
    driver,
    currentLocationName,
    destinationLocationName,
    currentLocation,
    marker,
    t,
    tn,
  ]);

  // Memoize expensive calculations to avoid recalculating on every render
  const estimatedFare = useMemo(() => {
    return distance
      ? (distance * parseInt(driver?.rate || "0")).toFixed(2)
      : "0.00";
  }, [distance, driver?.rate]);

  const estimatedDistance = useMemo(() => {
    return distance ? parseFloat(distance) : 0;
  }, [distance]);

  // Memoize map region to prevent unnecessary re-renders
  const memoizedRegion = useMemo(() => {
    return region;
  }, [
    region.latitude,
    region.longitude,
    region.latitudeDelta,
    region.longitudeDelta,
  ]);

  // Memoize map markers to prevent unnecessary re-renders
  const mapMarkers = useMemo(() => {
    return {
      destination: marker,
      pickup: currentLocation,
    };
  }, [
    marker?.latitude,
    marker?.longitude,
    currentLocation?.latitude,
    currentLocation?.longitude,
  ]);

  const activeRouteName = dashboardData.activeRoute.title;
  const activeRouteCurrentStop =
    currentLocationName || dashboardData.activeRoute.currentStop;
  const activeRouteNextStop =
    destinationLocationName || dashboardData.activeRoute.nextStop;
  const activeRouteEtaMinutes = distance
    ? Math.max(2, Math.round(Number(distance) * 3))
    : dashboardData.activeRoute.etaMinutes;

  const tripsDoneCount = dashboardData.tripsDone;
  const totalHoursValue = `${dashboardData.totalHours.toFixed(1)}h`;
  const todayEarningsValue = dashboardData.todayEarnings.toFixed(2);
  const scheduledTripsPreview = dashboardData.scheduledTrips.slice(0, 6);

  const formatTripChip = (scheduledTime: string) => {
    const tripDate = new Date(scheduledTime);
    if (Number.isNaN(tripDate.getTime())) return tc("upcoming");
    return tripDate
      .toLocaleString([], {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
      .toUpperCase()
      .replace(",", "");
  };

  return (
    <View style={[external.fx_1, { backgroundColor: colors.background }]}>
      <Header
        isOn={isOn}
        title={t("title")}
        showOnlineStatus
        showMenuButton
        showNotificationIcon={false}
      />
      <ScrollView
        style={styles.spaceBelow}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        refreshControl={
          <RefreshControl refreshing={dashboardRefreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <DriverStatusCard
          isOnline={isOn === true}
          isLoading={loading}
          onToggle={handleStatusChange}
          wsConnected={wsConnected}
          showConnectionStatus={false}
        />

        <View
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.lg,
            backgroundColor: color.primary,
            borderRadius: 26,
            overflow: "hidden",
          }}
        >
          <View style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.72)",
                    fontFamily: fonts.bold,
                    fontSize: fontSizes.FONT12,
                    letterSpacing: 2,
                  }}
                >
                  {t("activeRoute")}
                </Text>
                <Text
                  style={{
                    color: color.whiteColor,
                    fontFamily: fonts.bold,
                    fontSize: fontSizes.FONT34,
                    marginTop: spacing.xs,
                    maxWidth: "88%",
                  }}
                  numberOfLines={2}
                >
                  {activeRouteName}
                </Text>
              </View>
              <View
                style={{
                  minWidth: 72,
                  height: 72,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.16)",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Text style={{ color: color.whiteColor, fontFamily: fonts.bold, fontSize: 22 }}>
                  {activeRouteEtaMinutes > 0 ? activeRouteEtaMinutes : "--"}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.86)",
                    fontFamily: fonts.medium,
                    fontSize: fontSizes.FONT12,
                    marginTop: 2,
                  }}
                >
                  MINS
                </Text>
              </View>
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ color: "rgba(255,255,255,0.72)", fontFamily: fonts.medium, fontSize: fontSizes.FONT12 }}>
                Current Location
              </Text>
              <Text style={{ color: color.whiteColor, fontFamily: fonts.bold, fontSize: fontSizes.FONT20, marginTop: 2 }}>
                {activeRouteCurrentStop}
              </Text>
              <View style={{ width: 1, height: 16, backgroundColor: "rgba(255,255,255,0.35)", marginVertical: 6, marginLeft: 4 }} />
              <Text style={{ color: "rgba(255,255,255,0.72)", fontFamily: fonts.medium, fontSize: fontSizes.FONT12 }}>
                Next Stop
              </Text>
              <Text style={{ color: color.whiteColor, fontFamily: fonts.bold, fontSize: fontSizes.FONT20, marginTop: 2 }}>
                {activeRouteNextStop}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              backgroundColor: "rgba(0,0,0,0.12)",
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              gap: spacing.md,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                if (mapMarkers.destination && mapMarkers.pickup) {
                  setIsModalVisible(true);
                  return;
                }
                router.push("/(routes)/scheduled-trips");
              }}
              style={{
                flex: 1,
                borderRadius: 16,
                backgroundColor: color.whiteColor,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: spacing.md,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: color.primary, fontFamily: fonts.bold, fontSize: fontSizes.FONT18 }}>
                {t("viewMap")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                Toast.show(tn("arrivalConfirmed"), {
                  type: "success",
                  duration: 2000,
                })
              }
              style={{
                flex: 1,
                borderRadius: 16,
                backgroundColor: color.whiteColor,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: spacing.md,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: color.primary, fontFamily: fonts.bold, fontSize: fontSizes.FONT18 }}>
                {t("arrivedButton")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <View
            style={{
              backgroundColor: color.whiteColor,
              borderRadius: 24,
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              ...shadows.sm,
            }}
          >
            <View>
              <Text
                style={{
                  fontFamily: fonts.bold,
                  color: color.text.secondary,
                  letterSpacing: 1.8,
                  fontSize: fontSizes.FONT12,
                }}
              >
                {t("todaysEarningsLabel")}
              </Text>
              <Text
                style={{
                  marginTop: spacing.xs,
                  fontFamily: fonts.bold,
                  color: color.primary,
                  fontSize: fontSizes.FONT42,
                }}
              >
                ${dashboardLoading ? "--" : todayEarningsValue}
              </Text>
            </View>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#EEF0FF",
              }}
            >
              <Wallet colors={color.primary} />
            </View>
          </View>

          <View style={{ flexDirection: "row", marginTop: spacing.md, gap: spacing.md }}>
            <View
              style={{
                flex: 1,
                backgroundColor: color.whiteColor,
                borderRadius: 20,
                padding: spacing.lg,
                ...shadows.sm,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: "#EEF0FF",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing.md,
                }}
              >
                <SmartCar />
              </View>
              <Text style={{ color: color.text.secondary, fontFamily: fonts.bold, fontSize: fontSizes.FONT12, letterSpacing: 1 }}>
                {t("tripsDone")}
              </Text>
              <Text style={{ marginTop: 4, color: colors.text, fontFamily: fonts.bold, fontSize: fontSizes.FONT34 }}>
                {dashboardLoading ? "--" : tripsDoneCount}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: color.whiteColor,
                borderRadius: 20,
                padding: spacing.lg,
                ...shadows.sm,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: "#EEF0FF",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing.md,
                }}
              >
                <FillClock />
              </View>
              <Text style={{ color: color.text.secondary, fontFamily: fonts.bold, fontSize: fontSizes.FONT12, letterSpacing: 1 }}>
                {t("totalHours")}
              </Text>
              <Text style={{ marginTop: 4, color: colors.text, fontFamily: fonts.bold, fontSize: fontSizes.FONT34 }}>
                {dashboardLoading ? "--" : totalHoursValue}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xs,
            marginBottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontSize: fontSizes.FONT20,
              fontFamily: fonts.bold,
              color: colors.text,
            }}
          >
            {t("scheduledTrips")}
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(routes)/scheduled-trips")}
            activeOpacity={0.7}
          >
            <Text
              style={{
                color: color.primary,
                fontFamily: fonts.bold,
                fontSize: fontSizes.FONT13,
              }}
            >
              {t("seeAll")}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.lg,
            gap: spacing.md,
          }}
        >
          {scheduledTripsPreview.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push("/(routes)/scheduled-trips")}
              activeOpacity={0.8}
              style={{
                width: windowWidth(280),
                backgroundColor: color.whiteColor,
                borderRadius: 24,
                padding: spacing.lg,
                ...shadows.sm,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontFamily: fonts.bold,
                  fontSize: fontSizes.FONT20,
                }}
              >
                No upcoming trips
              </Text>
              <Text
                style={{
                  color: color.text.secondary,
                  fontFamily: fonts.regular,
                  fontSize: fontSizes.FONT14,
                  marginTop: spacing.xs,
                }}
              >
                Pull to refresh or check scheduled trips.
              </Text>
            </TouchableOpacity>
          ) : (
            scheduledTripsPreview.map((trip, index) => (
              <TouchableOpacity
                key={trip.id}
                onPress={() => router.push("/(routes)/scheduled-trips")}
                activeOpacity={0.8}
                style={{
                  width: windowWidth(280),
                  backgroundColor: color.whiteColor,
                  borderRadius: 24,
                  padding: spacing.lg,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    alignSelf: "flex-start",
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: index % 2 === 0 ? "#FFF0E1" : "#E9EEFF",
                    marginBottom: spacing.md,
                  }}
                >
                  <Text
                    style={{
                      color: index % 2 === 0 ? "#8A5A2C" : color.primary,
                      fontFamily: fonts.bold,
                      fontSize: fontSizes.FONT11,
                      letterSpacing: 1,
                    }}
                  >
                    {formatTripChip(trip.scheduledTime)}
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: fonts.bold,
                    fontSize: fontSizes.FONT26,
                  }}
                  numberOfLines={1}
                >
                  {trip.name}
                </Text>
                <Text
                  style={{
                    color: color.text.secondary,
                    fontFamily: fonts.regular,
                    fontSize: fontSizes.FONT14,
                    marginTop: 4,
                  }}
                  numberOfLines={1}
                >
                  {trip.points?.length || 0}{" "}
                  {(trip.points?.length || 0) === 1
                    ? t("checkpoint")
                    : t("checkpoints")}{" "}
                  - {trip.points?.[trip.points.length - 1]?.name || t("routeFallback")}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </ScrollView>

      {/* Enhanced Ride Request Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClose}
      >
        <View style={styles.modalBackground}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: "rgba(255,255,255,0.92)",
                maxHeight: "90%",
                borderTopLeftRadius: 40,
                borderTopRightRadius: 40,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t("newRideRequest")}
                </Text>
                <Text
                  style={{
                    color: color.text.secondary,
                    fontSize: fontSizes.FONT13,
                    fontFamily: fonts.regular,
                    marginTop: spacing.xs / 2,
                  }}
                >
                  {t("rideReviewSubtitle")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={[
                  styles.closeButton,
                  {
                    borderRadius: 16,
                    backgroundColor: "#EFF1F5",
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 20, color: colors.text }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Map View - Larger */}
              <View
                style={{
                  height: windowHeight(300),
                  borderRadius: 20,
                  overflow: "hidden",
                  marginBottom: spacing.lg,
                  position: "relative",
                }}
              >
                <MapView
                  style={{ flex: 1 }}
                  region={memoizedRegion}
                  onRegionChangeComplete={useCallback((newRegion: any) => {
                    setRegion(newRegion);
                  }, [])}
                  onMapReady={useCallback(() => {
                    console.log(
                      "✅ Home screen map ready and loaded successfully"
                    );
                    setMapReady(true);
                    setMapLoading(false);
                    setMapError(null);
                  }, [])}
                >
                  {mapMarkers.destination && (
                    <Marker
                      coordinate={mapMarkers.destination}
                      title={t("destination")}
                      pinColor={color.status.active}
                    />
                  )}
                  {mapMarkers.pickup && (
                    <Marker
                      coordinate={mapMarkers.pickup}
                      title={t("pickup")}
                      pinColor={color.status.completed}
                    />
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
                  <View
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      right: 10,
                      backgroundColor: "rgba(239, 68, 68, 0.9)",
                      padding: 12,
                      borderRadius: 14,
                      zIndex: 1000,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      {t("mapErrorPrefix")} {mapError}
                    </Text>
                  </View>
                )}

                {/* Map Loading Indicator */}
                {mapLoading && !mapError && (
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
                      zIndex: 999,
                    }}
                  >
                    <Text style={{ color: "white", fontSize: 14 }}>
                      {t("loadingMap")}
                    </Text>
                  </View>
                )}
              </View>

              {/* Passenger Info */}
              {userData && (
                <View style={{ marginBottom: spacing.lg }}>
                  <PassengerCard passenger={userData} />
                </View>
              )}

              {/* Location Details */}
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.96)",
                  borderRadius: 24,
                  padding: spacing.lg,
                  marginBottom: spacing.lg,
                }}
              >
                <View
                  style={{ flexDirection: "row", marginBottom: spacing.md }}
                >
                  <View style={styles.leftView}>
                    <Location color={color.status.completed} />
                    <View
                      style={[
                        styles.verticaldot,
                        { borderColor: color.primary },
                      ]}
                    />
                    <Gps colors={color.status.active} />
                  </View>
                  <View style={[styles.rightView, { flex: 1 }]}>
                    <Text
                      style={[
                        styles.pickup,
                        { color: colors.text, marginBottom: spacing.sm },
                      ]}
                      numberOfLines={2}
                    >
                      {currentLocationName || tc("pickupLocation")}
                    </Text>
                    <View style={{ height: 10 }} />
                    <Text
                      style={[styles.drop, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {destinationLocationName || tc("destination")}
                    </Text>
                  </View>
                </View>

                {/* ETA and Distance */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: spacing.md,
                  }}
                >
                  <ETADisplay distance={estimatedDistance} size="md" />
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontSize: fontSizes.FONT10,
                        fontFamily: fonts.bold,
                        color: color.text.secondary,
                        marginBottom: spacing.xs / 2,
                        letterSpacing: 0.8,
                      }}
                    >
                      {t("fareLabel")}
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSizes.FONT20,
                        fontFamily: fonts.bold,
                        color: color.primary,
                      }}
                    >
                      {estimatedFare} BDT
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.md,
                  marginBottom: spacing.lg,
                }}
              >
                <TouchableOpacity
                  onPress={handleClose}
                  activeOpacity={0.9}
                  style={{
                    width: "48%",
                    height: 56,
                    borderRadius: 20,
                    backgroundColor: "#FCECEC",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: color.semantic.error,
                      fontFamily: fonts.bold,
                      fontSize: fontSizes.FONT16,
                    }}
                  >
                    {t("decline")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => acceptRideHandler()}
                  disabled={loading}
                  activeOpacity={0.9}
                  style={{
                    width: "48%",
                    height: 56,
                    borderRadius: 20,
                    backgroundColor: loading ? "#8D90A0" : color.primary,
                    justifyContent: "center",
                    alignItems: "center",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontFamily: fonts.bold,
                      fontSize: fontSizes.FONT16,
                    }}
                  >
                    {loading ? t("accepting") : t("acceptRide")}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Offline Confirmation Modal */}
      <Modal
        visible={showOfflineConfirmation}
        animationType="fade"
        transparent={true}
        onRequestClose={cancelGoOffline}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: borderRadius.lg,
              padding: spacing.xl,
              width: "100%",
              maxWidth: 400,
              ...shadows.lg,
            }}
          >
            <Text
              style={{
                fontSize: fontSizes.FONT20,
                fontFamily: fonts.bold,
                color: colors.text,
                marginBottom: spacing.md,
                textAlign: "center",
              }}
            >
              {t("goOfflineTitle")}
            </Text>
            <Text
              style={{
                fontSize: fontSizes.FONT14,
                fontFamily: fonts.regular,
                color: color.text.secondary,
                marginBottom: spacing.xl,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              {t("offlineModalDetail")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
              }}
            >
              <Button
                title={tc("cancel")}
                onPress={cancelGoOffline}
                width="48%"
                height={windowHeight(50)}
                backgroundColor={color.text.secondary}
              />
              <Button
                title={t("confirmOffline")}
                onPress={confirmGoOffline}
                width="48%"
                height={windowHeight(50)}
                backgroundColor={color.semantic.error}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
