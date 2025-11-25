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
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Header from "@/components/common/header";
import { useTheme } from "@react-navigation/native";
import { external } from "@/styles/external.style";
import styles from "./styles";
import RideCard from "@/components/ride/ride.card";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { windowHeight, windowWidth, fontSizes } from "@/themes/app.constant";
import { Gps, Location, Calender } from "@/utils/icons";
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
import { spacing, shadows } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import OverviewSection from "@/components/home/OverviewSection";
import { runMapDiagnostics, logMapDiagnostics } from "@/utils/mapDiagnostics";
import { requestAllLocationPermissions, hasBackgroundLocationPermission, getLocationPermissionStatus } from "@/utils/locationPermissions";
import { promptDisableBatteryOptimization, showBatteryOptimizationInstructions } from "@/utils/batteryOptimization";
import { shouldSendLocationUpdate } from "@/utils/locationOptimizer";
import { setWebSocketConnection, BACKGROUND_LOCATION_TASK } from "@/services/backgroundLocationTask";
import * as TaskManager from "expo-task-manager";

export default function HomeScreen() {
  const notificationListener = useRef<any>();
  const { driver, loading: DriverDataLoading } = useGetDriverData();
  const [userData, setUserData] = useState<any>(null);
  const [isOn, setIsOn] = useState<any>();
  const [loading, setloading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
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
  const [recentRides, setrecentRides] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const ws = useRef<WebSocket | null>(null);
  const locationWatchSubscription = useRef<any>(null);
  const isOnRef = useRef<any>(undefined); // Track isOn in ref so callbacks always have latest value
  const processedNotificationIds = useRef<Set<string>>(new Set()); // Track processed notification IDs to prevent duplicates
  const isProcessingNotification = useRef<boolean>(false); // Prevent concurrent notification processing
  
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
    setRefreshing(true);
    // Trigger refresh in OverviewSection
    setRefreshTrigger(prev => prev + 1);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

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
      console.log("🔔 Notification data:", JSON.stringify(notification.request.content.data, null, 2));
      console.log("🔔 Notification trigger:", notification.request.trigger);
      
      // CRITICAL: Return shouldShowAlert: false to allow JavaScript listener to handle it
      // If we return true, Expo shows a system notification and the listener might not fire
      // We want to process the notification in JavaScript to show the modal
      return {
        shouldShowAlert: false,  // Don't show system alert - let JavaScript handle it
        shouldPlaySound: true,   // Play sound
        shouldSetBadge: false,   // Don't set badge
      };
    },
  });

  // Helper function to handle notification data
  const handleNotificationData = (notificationData: any, notificationId?: string) => {
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
        const userPhone = notificationData?.orderData?.user?.phone_number || 
                         notificationData?.user?.phone_number || 
                         notificationData?.orderData?.user?.id ||
                         notificationData?.user?.id ||
                         Date.now().toString();
        uniqueId = `notification_${userPhone}_${Date.now()}`;
      }

      // Check if this notification was already processed
      if (processedNotificationIds.current.has(uniqueId)) {
        console.log(`⚠️ Notification ${uniqueId} already processed, ignoring duplicate`);
        return;
      }

      // Mark as processing
      isProcessingNotification.current = true;

      // Mark this notification ID as processed
      processedNotificationIds.current.add(uniqueId);

      // Clean up old notification IDs (keep only last 10 to prevent memory leak)
      if (processedNotificationIds.current.size > 10) {
        const firstId = processedNotificationIds.current.values().next().value;
        processedNotificationIds.current.delete(firstId);
      }

      console.log("📬 Processing notification data:", JSON.stringify(notificationData, null, 2));
      console.log("📬 Notification ID:", uniqueId);
      
      // The notification data structure from Expo is: notification.request.content.data
      // And we send: { orderData: JSON.stringify(data) }
      // So we need to extract orderData and parse it
      let orderData;
      
      // Check if notificationData has orderData property
      if (notificationData && notificationData.orderData) {
        // orderData might be a stringified JSON or already an object
        if (typeof notificationData.orderData === 'string') {
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
      } else if (typeof notificationData === 'string') {
        // Maybe the entire notificationData is a stringified JSON
        try {
          orderData = JSON.parse(notificationData);
          console.log("✅ Parsed entire notificationData as JSON:", orderData);
        } catch (parseError) {
          console.error("❌ Error parsing notificationData as JSON:", parseError);
          return;
        }
      } else {
        // Maybe notificationData itself is the orderData
        orderData = notificationData;
        console.log("✅ Using notificationData directly as orderData:", orderData);
      }
      
      console.log("📦 Final orderData:", JSON.stringify(orderData, null, 2));
      
      // Check if this is a trip activation notification
      if (orderData && orderData.type === "tripActivation") {
        console.log("📬 Trip activation notification received:", orderData);
        Toast.show(`Trip "${orderData.tripName}" is now available to start!`, {
          type: "success",
          duration: 5000,
        });
        // Navigate to scheduled trips screen
        setTimeout(() => {
          router.push("/(routes)/scheduled-trips");
        }, 2000);
        return;
      }

      // Validate required fields
      if (!orderData) {
        console.error("❌ No orderData found in notification");
        Toast.show("Invalid notification format", {
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
        Toast.show("Invalid ride request data - missing location or user info", {
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
      const latDelta = Math.abs(
        pickupLocation.latitude - destinationLocation.latitude
      ) * 2;
      const lonDelta = Math.abs(
        pickupLocation.longitude - destinationLocation.longitude
      ) * 2;
      
      setRegion({
        latitude: (pickupLocation.latitude + destinationLocation.latitude) / 2,
        longitude: (pickupLocation.longitude + destinationLocation.longitude) / 2,
        latitudeDelta: Math.max(latDelta, 0.0922),
        longitudeDelta: Math.max(lonDelta, 0.0421),
      });
      
      setdistance(orderData.distance || "0");
      setcurrentLocationName(orderData.currentLocationName || orderData.currentLocation?.name || "Pickup Location");
      setdestinationLocationName(orderData.destinationLocation || orderData.destinationLocationName || orderData.marker?.name || "Destination");
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
      setIsModalVisible(prev => {
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
      console.error("Raw notification data:", JSON.stringify(notificationData, null, 2));
      Toast.show(`Error processing ride request: ${error.message}`, {
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
    Notifications.getPermissionsAsync().then((permissions) => {
      console.log("🔔 Notification permissions:", JSON.stringify(permissions, null, 2));
      if (!permissions.granted) {
        console.error("❌ Notification permissions not granted!");
        Toast.show("Notification permissions not granted. Please enable notifications in settings.", {
          type: "danger",
          duration: 5000,
        });
      } else {
        console.log("✅ Notification permissions granted");
      }
    }).catch((error) => {
      console.error("❌ Error checking notification permissions:", error);
    });
    
    // CRITICAL: Handle notifications received while app is in FOREGROUND
    // This listener will ONLY fire if shouldShowAlert: false in the notification handler
    // With shouldShowAlert: false, Expo won't show a system notification, and our listener will process it
    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log("📱 ===== NOTIFICATION RECEIVED - LISTENER FIRED =====");
      console.log("📱 Listener timestamp:", new Date().toISOString());
      console.log("📱 Notification ID:", notification.request.identifier);
      console.log("📱 Notification title:", notification.request.content.title);
      console.log("📱 Notification body:", notification.request.content.body);
      console.log("📱 Notification trigger type:", notification.request.trigger?.type);
      console.log("📱 Notification structure check:", {
        hasRequest: !!notification.request,
        hasContent: !!notification.request?.content,
        hasData: !!notification.request?.content?.data,
        contentKeys: notification.request?.content ? Object.keys(notification.request.content) : [],
      });
      
      // Prevent processing if already processing or modal is visible
      if (isProcessingNotification.current || isModalVisible) {
        console.log("⚠️ Already processing notification or modal visible, ignoring");
        return;
      }
      
      // Show toast immediately to confirm notification was received
      Toast.show("📱 New ride request received!", {
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
        console.log("📦 STEP 6: Data keys:", data ? Object.keys(data) : "No keys");
        console.log("📦 STEP 7: Full data JSON:", JSON.stringify(data, null, 2));
        
        if (!data) {
          console.error("❌ ERROR: No data in notification.request.content.data");
          console.error("❌ Full notification content:", JSON.stringify(notification.request.content, null, 2));
          Toast.show("Notification received but no data found", {
            type: "warning",
            duration: 3000,
          });
          return;
        }
        
        // CRITICAL: Process notification data immediately with notification ID
        console.log("🔄 STEP 8: Calling handleNotificationData...");
        handleNotificationData(data, notification.request.identifier);
        console.log("✅ STEP 9: handleNotificationData called - modal should appear");
      } catch (error: any) {
        console.error("❌ ERROR: Exception in notification listener");
        console.error("❌ Error message:", error.message);
        console.error("❌ Error stack:", error.stack);
        console.error("❌ Error details:", JSON.stringify(error, null, 2));
        Toast.show(`Error: ${error.message}`, {
          type: "danger",
          duration: 5000,
        });
      }
    });

    // Handle notifications that open the app (when user TAPS on notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("👆 ===== NOTIFICATION TAPPED - APP OPENED =====");
      console.log("👆 Timestamp:", new Date().toISOString());
      console.log("👆 Action identifier:", response.actionIdentifier);
      console.log("👆 Full response:", JSON.stringify(response, null, 2));
      
      // Prevent processing if already processing or modal is visible
      if (isProcessingNotification.current || isModalVisible) {
        console.log("⚠️ Already processing notification or modal visible, ignoring tapped notification");
        return;
      }
      
      // Show a toast to indicate notification was tapped
      Toast.show("👆 Notification tapped - opening app...", {
        type: "info",
        duration: 3000,
      });
      
      try {
        const data = response.notification.request.content.data;
        console.log("📦 Raw data from tapped notification:", data);
        console.log("📦 Data type:", typeof data);
        console.log("📦 Extracted data:", JSON.stringify(data, null, 2));
        
        if (!data) {
          console.error("❌ No data found in tapped notification");
          Toast.show("Notification tapped but no data found", {
            type: "warning",
            duration: 3000,
          });
          return;
        }
        
        // Delay slightly to ensure app is fully loaded
        console.log("🔄 Processing tapped notification data...");
        setTimeout(() => {
          handleNotificationData(data, response.notification.request.identifier);
        }, 500);
      } catch (error: any) {
        console.error("❌ Error handling tapped notification:", error);
        console.error("❌ Error stack:", error.stack);
        Toast.show(`Error processing tapped notification: ${error.message}`, {
          type: "danger",
          duration: 5000,
        });
      }
    });

    // Check if app was opened from a notification (when app was CLOSED)
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          console.log("🚀 ===== APP WAS OPENED FROM NOTIFICATION =====");
          console.log("🚀 Timestamp:", new Date().toISOString());
          console.log("🚀 Last notification response:", JSON.stringify(response, null, 2));
          
          // Prevent processing if already processing or modal is visible
          if (isProcessingNotification.current || isModalVisible) {
            console.log("⚠️ Already processing notification or modal visible, ignoring last notification");
            return;
          }
          
          // Show a toast to indicate app was opened from notification
          Toast.show("🚀 App opened from notification", {
            type: "info",
            duration: 3000,
          });
          
          try {
            const data = response.notification.request.content.data;
            console.log("📦 Raw data from last notification:", data);
            console.log("📦 Data type:", typeof data);
            console.log("📦 Extracted data:", JSON.stringify(data, null, 2));
            
            if (data) {
              // Delay to ensure app is fully loaded before showing modal
              console.log("🔄 Processing last notification data...");
              setTimeout(() => {
                handleNotificationData(data, response.notification.request.identifier);
              }, 1000);
            } else {
              console.error("❌ No data found in last notification");
              Toast.show("Notification found but no data available", {
                type: "warning",
                duration: 3000,
              });
            }
          } catch (error: any) {
            console.error("❌ Error handling last notification:", error);
            console.error("❌ Error stack:", error.stack);
            Toast.show(`Error processing last notification: ${error.message}`, {
              type: "danger",
              duration: 5000,
            });
          }
        } else {
          console.log("ℹ️ App opened normally (not from notification)");
        }
      })
      .catch((error) => {
        console.error("❌ Error checking last notification:", error);
        console.error("❌ Error stack:", error.stack);
      });

    console.log("✅ Notification listeners set up successfully");
    console.log("✅ Foreground listener:", foregroundSubscription ? "✅ Active" : "❌ Failed");
    console.log("✅ Response listener:", responseSubscription ? "✅ Active" : "❌ Failed");

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
      console.log(`📋 Driver status loaded from storage: "${status}" -> isOn=${newIsOn}`);
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
    const subscription = AppState.addEventListener("change", async (nextAppState: AppStateStatus) => {
      console.log(`📱 App state changed: ${nextAppState}`);
      
      if (nextAppState === "background" || nextAppState === "inactive") {
        console.log("📱 App moved to background - location tracking should continue if permissions are granted");
        
        // Check if we have background permission
        const hasBackground = await hasBackgroundLocationPermission();
        if (!hasBackground && isOnRef.current === true) {
          console.warn("⚠️ App in background but background location permission not granted");
          Toast.show("Background location permission required for tracking when screen is off", {
            type: "warning",
            duration: 3000,
          });
        } else if (hasBackground && isOnRef.current === true) {
          console.log("✅ Background location permission granted - tracking will continue");
        }
      } else if (nextAppState === "active") {
        console.log("📱 App moved to foreground");
        
        // When app comes to foreground, verify permissions are still granted
        if (isOnRef.current === true) {
          const permissionStatus = await getLocationPermissionStatus();
          console.log("📍 Permission status on foreground:", permissionStatus);
          
          if (!permissionStatus.background && Platform.OS === "android") {
            console.warn("⚠️ Background location permission may have been revoked");
          }
        }
      }
    });

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
          console.log("🔑 Driver is logged in - registering for push notifications...");
          await registerForPushNotificationsAsync();
        } else {
          console.warn("⚠️ Driver not logged in - skipping push notification registration");
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
    appStateSubscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
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
    });
    
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
      console.log("⚠️ Token registration already in progress, skipping duplicate call...");
      return;
    }
    
    // Set registration in progress flag
    isRegisteringToken.current = true;
    
    try {
      console.log("🔔 ===== STARTING PUSH NOTIFICATION REGISTRATION =====");
      console.log("🔔 Timestamp:", new Date().toISOString());
      
      if (!isPhysicalDevice()) {
        console.warn("⚠️ Not a physical device - push notifications not available");
        Toast.show("Must use physical device for Push Notifications", {
          type: "danger",
        });
        isRegisteringToken.current = false;
        return;
      }
    
      // Step 1: Request/check notification permissions
      console.log("📋 Step 1: Checking notification permissions...");
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== "granted") {
        console.log("📋 Requesting notification permissions...");
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== "granted") {
        console.error("❌ Notification permissions not granted:", finalStatus);
        Toast.show("Failed to get push token for push notification!", {
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
        Toast.show("Failed to get project id for push notification!", {
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
        Toast.show("Failed to get push token", {
          type: "danger",
        });
        isRegisteringToken.current = false;
        return;
      }
      
      // Validate token format
      if (!pushTokenString.startsWith("ExponentPushToken[")) {
        console.error("❌ Invalid push token format:", pushTokenString);
        Toast.show("Invalid push token format", {
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
        console.log("✅ Token already saved previously, skipping save operation...");
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
              console.log(`🔄 Attempting to save token (attempt ${i + 1}/${retries})...`);
              
              // Wait a bit longer on first few attempts to ensure driver is logged in
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
              
              const accessToken = await AsyncStorage.getItem("accessToken");
              
              if (!accessToken) {
                console.warn(`⚠️ Access token not available (attempt ${i + 1})`);
                console.warn(`⚠️ Driver may not be logged in yet - will retry...`);
                if (i < retries - 1) {
                  continue;
                } else {
                  console.error("❌ Failed to save token: No access token after all retries");
                  console.error("❌ Driver must be logged in to save notification token");
                  console.error("❌ Token will be saved automatically when driver logs in");
                  Toast.show("Please log in to enable push notifications", {
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
              console.log("📤 Server URL:", `${getServerUri()}/driver/update-notification-token`);
              
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
              console.log("✅ Server response:", JSON.stringify(response.data, null, 2));
              console.log("✅ Token in database:", response.data?.driver?.notificationToken);
              
              // Verify token matches
              if (response.data?.driver?.notificationToken === pushTokenString) {
                console.log("✅ Token verification: MATCH - notifications should work!");
                
                // Only show toast if this is a new token (not already saved)
                const isNewToken = lastSavedToken.current !== pushTokenString;
                if (isNewToken) {
                  Toast.show("Push notifications enabled!", {
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
                console.error("❌ Got:", response.data?.driver?.notificationToken);
                console.error("❌ This will cause notifications to fail!");
              }
              
              return; // Success, exit function
            } catch (error: any) {
              console.error(`❌ Error saving notification token (attempt ${i + 1}):`, error.message);
              console.error("❌ Error response:", error.response?.data);
              console.error("❌ Error status:", error.response?.status);
              console.error("❌ Error code:", error.code);
              
              // Check if it's a network error
              if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                console.warn("⚠️ Request timeout - network may be slow");
              } else if (error.response?.status === 401) {
                console.error("❌ Unauthorized - access token may be invalid");
                console.error("❌ Driver may need to log in again");
                Toast.show("Please log in again to enable notifications", {
                  type: "warning",
                  duration: 3000,
                });
                return; // Don't retry if unauthorized
              } else if (error.response?.status >= 500) {
                console.warn("⚠️ Server error - will retry");
              }
              
              if (i < retries - 1) {
                console.log(`⏳ Waiting ${2 * (i + 1)} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
              } else {
                console.error("❌ Failed to save notification token after all retries");
                console.error("❌ Notifications will NOT work until token is saved!");
                console.error("❌ Possible causes:");
                console.error("   1. Driver is not logged in");
                console.error("   2. Network connection issue");
                console.error("   3. Server is down");
                console.error("   4. Access token is invalid");
                Toast.show("Failed to save notification token. Please check your connection and try again.", {
                  type: "warning",
                  duration: 5000,
                });
              }
            }
          }
        };
        
        // Save token to database and wait for completion
        // This ensures the registration flag is only reset after save completes
        await saveTokenToDatabase().catch(err => {
          console.error("❌ Unexpected error in token save process:", err);
          console.error("❌ Error stack:", err.stack);
        });
      } catch (e: any) {
        console.error("Error getting push token:", e);
        
        // Check if it's a Firebase initialization error
        const errorMessage = e?.message || String(e);
        const isFirebaseError = errorMessage.includes("FirebaseApp") || errorMessage.includes("Firebase");
        
        if (isFirebaseError) {
          console.warn("Firebase not initialized. This usually happens when:");
          console.warn("1. The app needs to be rebuilt with expo-notifications plugin");
          console.warn("2. Run: npx expo prebuild --clean (if using bare workflow)");
          console.warn("3. Or rebuild the app with: npx expo run:android");
          console.warn("4. Push notifications will work after rebuilding the app");
          
          // Don't show error to user - this is a configuration issue that needs a rebuild
          // The app can still function without push notifications
        } else if (isPhysicalDevice()) {
          // Only show other errors on real devices
          Toast.show("Push notifications may not be available. Please rebuild the app.", {
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

  // socket updates with automatic reconnection
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const reconnectDelay = 3000; // 3 seconds

    const connectWebSocket = () => {
      const wsUrl = getWebSocketUrl();
      console.log(`🔌 Attempting to connect to WebSocket: ${wsUrl} (Attempt ${reconnectAttempts + 1})`);
      
      try {
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log("✅ Connected to WebSocket server successfully");
          setWsConnected(true);
          reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          // Set WebSocket connection for background task
          setWebSocketConnection(ws.current);
        };

        ws.current.onmessage = (e) => {
          try {
            // Check if this is a binary message (ping/pong)
            if (typeof e.data === 'string') {
              const message = JSON.parse(e.data);
              console.log("📨 Received WebSocket message:", message);
              // Handle received location updates here
            } else {
              // Binary data - likely a ping/pong frame
              // React Native WebSocket automatically handles ping/pong
              console.log("🏓 Received ping/pong frame");
            }
          } catch (error) {
            console.error("❌ Error parsing WebSocket message:", error);
          }
        };

        ws.current.onerror = (e: any) => {
          const errorMsg = e.message || "Unknown error";
          console.error(`❌ WebSocket error: ${errorMsg}`);
          console.error("❌ Error details:", JSON.stringify(e, null, 2));
          setWsConnected(false);
          
          // Don't immediately reconnect on error - wait for close event
          // The close event will handle reconnection logic
        };

        ws.current.onclose = (e) => {
          const wasClean = e.wasClean !== undefined ? e.wasClean : false;
          console.log(`🔌 WebSocket closed: code=${e.code}, reason="${e.reason || 'No reason provided'}", wasClean=${wasClean}`);
          setWsConnected(false);
          
          // Attempt to reconnect if we haven't exceeded max attempts
          // Code 1006 (abnormal closure) or other non-clean closures should reconnect
          // Code 1000 (normal closure) or 1001 (going away) typically shouldn't reconnect
          const shouldReconnect = !wasClean && 
                                  e.code !== 1000 && 
                                  e.code !== 1001 && 
                                  reconnectAttempts < maxReconnectAttempts;
          
          if (shouldReconnect) {
            reconnectAttempts++;
            console.log(`🔄 Will attempt to reconnect in ${reconnectDelay/1000} seconds... (${reconnectAttempts}/${maxReconnectAttempts})`);
            
            reconnectTimeout = setTimeout(() => {
              console.log(`🔄 Attempting reconnection ${reconnectAttempts}/${maxReconnectAttempts}...`);
              connectWebSocket();
            }, reconnectDelay);
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            console.error(`❌ Max reconnection attempts (${maxReconnectAttempts}) reached. Please check WebSocket server.`);
            console.error(`   Last close code: ${e.code}, wasClean: ${wasClean}`);
          } else if (wasClean) {
            console.log(`ℹ️ Connection closed cleanly (code ${e.code}). Not reconnecting.`);
          }
        };
      } catch (error: any) {
        console.error("❌ Failed to create WebSocket:", error);
        setWsConnected(false);
        
        // Retry connection
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          reconnectTimeout = setTimeout(() => {
            connectWebSocket();
          }, reconnectDelay);
        }
      }
    };

    // Initial connection
    connectWebSocket();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws.current) {
        console.log("🧹 Cleaning up WebSocket connection");
        setWebSocketConnection(null); // Clear WebSocket from background task
        ws.current.close();
        ws.current = null;
      }
    };
  }, []);

  // Track previous isOn value to detect when driver becomes active
  const prevIsOnRef = useRef<any>(undefined);
  
  // Send initial location when WebSocket connects and driver is active
  useEffect(() => {
    console.log(`🔄 Location send effect triggered: wsConnected=${wsConnected}, isOn=${isOn}, hasLocation=${!!currentLocation}`);
    
    const driverJustBecameActive = prevIsOnRef.current !== true && isOn === true;
    prevIsOnRef.current = isOn;
    
    if (driverJustBecameActive) {
      console.log("🔄 Driver just became active!");
    }
    
    if (wsConnected && isOn === true && currentLocation && ws.current && ws.current.readyState === WebSocket.OPEN) {
      // Send immediately if driver just became active or this is initial connection
      if (driverJustBecameActive || !lastLocation) {
        console.log("✅ All conditions met - sending location immediately");
        sendLocationUpdate(currentLocation).catch(error => {
          console.error("❌ Error sending initial location:", error);
        });
      }
    } else {
      if (!wsConnected) console.log("⚠️ WebSocket not connected");
      if (isOn !== true) console.log(`⚠️ Driver not active (isOn=${isOn})`);
      if (!currentLocation) console.log("⚠️ No current location yet");
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) console.log("⚠️ WebSocket not ready");
    }
  }, [wsConnected, isOn, currentLocation]);

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

  const sendLocationUpdate = async (location: any) => {
    // Only send location updates if driver is active (use ref to get latest value)
    const currentIsOn = isOnRef.current;
    if (!currentIsOn) {
      console.log(`⚠️ Driver is inactive (isOn=${currentIsOn}) - skipping location update`);
      return;
    }

    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.log("⚠️ WebSocket not connected - cannot send location update");
      return;
    }

    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      console.error("❌ No access token - cannot fetch driver data");
      return;
    }

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
          ws.current.send(message);
          
          // Also update location for scheduled trips (only if driver is online)
          // The backend will check if driver is online, so we can safely call this
          axios.post(
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
          ).then((res) => {
            if (res.data.success && res.data.activationChecks) {
              // Check if any trips became available
              const availableTrips = res.data.activationChecks.filter(
                (check: any) => check.canActivate
              );
              if (availableTrips.length > 0) {
                console.log(`✅ ${availableTrips.length} trip(s) are now available to start`);
                // Notification will be sent by the backend
              }
            }
          }).catch((error) => {
            // Non-critical error - might be because driver is offline
            if (error.response?.status === 400 && error.response?.data?.message?.includes("online")) {
              console.log("⚠️ Location update skipped - driver is offline");
            } else {
              console.log("⚠️ Failed to update location for scheduled trips:", error.message);
            }
          });
        } else {
          console.error("❌ No driver data in response");
        }
      })
      .catch((error) => {
        console.error("❌ Error fetching driver data:", error);
      });
  };

  useEffect(() => {
    (async () => {
      // Clean up previous subscription if it exists
      if (locationWatchSubscription.current) {
        locationWatchSubscription.current.remove();
        locationWatchSubscription.current = null;
      }

      // Request all location permissions (foreground + background)
      console.log("📍 Requesting location permissions...");
      const { foreground, background } = await requestAllLocationPermissions();
      
      if (!foreground) {
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
      } else {
        console.log("✅ Background location permission granted");
      }

      // Check permission status for logging
      const permissionStatus = await getLocationPermissionStatus();
      console.log("📍 Location permission status:", permissionStatus);

      console.log(`📍 Setting up location watcher with isOn=${isOn}`);

      // Track if this is the first location after driver becomes active
      let firstLocationAfterActive = isOn === true;

      // Check if background task is registered
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (!isTaskRegistered) {
        console.warn("⚠️ Background location task not registered - location updates may not work in background");
      }

      // Start background location updates using task manager
      // This works even when the app is in the background
      if (isOn) {
        try {
          await GeoLocation.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: GeoLocation.Accuracy.High,
            timeInterval: 5000, // 5 seconds
            distanceInterval: 10, // 10 meters
            foregroundService: {
              notificationTitle: "Location Tracking Active",
              notificationBody: "Tracking your location for ride requests",
              notificationColor: "#10B981",
            },
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
          });
          console.log("✅ Background location tracking started");
        } catch (error: any) {
          console.error("❌ Error starting background location tracking:", error);
        }
      }

      // Also set up a foreground watcher for immediate UI updates
      // This provides faster updates when the app is in the foreground
      const subscription = await GeoLocation.watchPositionAsync(
        {
          accuracy: GeoLocation.Accuracy.High,
          timeInterval: 5000, // 5 seconds - better for background
          distanceInterval: 10, // 10 meters - reduces battery drain
          mayShowUserSettingsDialog: true,
        },
        async (position) => {
          const { latitude, longitude, heading } = position.coords;
          const newLocation = { 
            latitude, 
            longitude,
            heading: heading !== null && heading !== undefined && heading >= 0 ? heading : undefined
          };
          
          // Always update current location
          setCurrentLocation(newLocation);
          
          // Use ref to get latest isOn value (avoid stale closure)
          const currentIsOn = isOnRef.current;
          const currentWs = ws.current;
          
          // Only send location update if driver is active and WebSocket is connected
          if (currentIsOn === true && currentWs && currentWs.readyState === WebSocket.OPEN) {
            // Use optimized location update check
            const currentLastLocation = lastLocation;
            const shouldSend = firstLocationAfterActive || 
                              shouldSendLocationUpdate(currentLastLocation, newLocation, 200);
            
            if (shouldSend) {
              const isFirstAfterActive = firstLocationAfterActive;
              firstLocationAfterActive = false; // Reset flag after first send
              setLastLocation(newLocation);
              await sendLocationUpdate(newLocation);
            } else {
              // Even if location didn't change much, still update lastLocation
              setLastLocation(newLocation);
              console.log(`📍 Location update skipped (change < 200m)`);
            }
          } else {
            // Update lastLocation even if not sending update
            setLastLocation(newLocation);
            if (currentIsOn !== true) {
              console.log(`📍 Location received but driver is inactive (isOn=${currentIsOn}) - not sending`);
            } else if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
              console.log(`📍 Location received but WebSocket not connected (readyState=${currentWs?.readyState}) - not sending`);
            }
          }
        }
      );
      
      locationWatchSubscription.current = subscription;
      
      return () => {
        // Stop foreground watcher
        if (locationWatchSubscription.current) {
          locationWatchSubscription.current.remove();
          locationWatchSubscription.current = null;
        }
        
        // Stop background location updates if driver is inactive
        if (!isOn) {
          (async () => {
            try {
              const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
              if (isTaskRegistered) {
                const hasStarted = await GeoLocation.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                if (hasStarted) {
                  await GeoLocation.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                  console.log("🛑 Background location tracking stopped");
                }
              }
            } catch (error: any) {
              console.error("❌ Error stopping background location tracking:", error);
            }
          })();
        }
      };
    })();
  }, [isOn]); // Re-run when isOn changes to start/stop sending location updates

  const getRecentRides = async () => {
    const accessToken = await AsyncStorage.getItem("accessToken");
    const res = await axios.get(
      `${getServerUri()}/driver/get-rides`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    setrecentRides(res.data.rides);
  };

  // Recent Rides fetching - Temporarily disabled
  // useEffect(() => {
  //   getRecentRides();
  // }, []);

  // Memoize handleClose to prevent unnecessary re-renders
  const handleClose = useCallback(() => {
    setIsModalVisible(false);
    // Reset processing flag when modal is closed
    isProcessingNotification.current = false;
  }, []);

  // Memoize handleStatusChange to prevent unnecessary re-renders
  const handleStatusChange = useCallback(async () => {
    if (!loading) {
      setloading(true);
      const accessToken = await AsyncStorage.getItem("accessToken");
      const newStatus = !isOn ? "active" : "inactive";
      
      const changeStatus = await axios.put(
        `${getServerUri()}/driver/update-status`,
        {
          status: newStatus,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (changeStatus.data) {
        const newIsOn = !isOn;
        setIsOn(newIsOn);
        isOnRef.current = newIsOn; // Update ref immediately
        await AsyncStorage.setItem("status", changeStatus.data.driver.status);
        
        // Start/stop foreground service and handle location tracking
        if (newStatus === "active") {
          // Driver going active - start foreground service and prompt for battery optimization
          try {
            // Check if we have background permission
            const hasBackground = await hasBackgroundLocationPermission();
            if (!hasBackground) {
              console.warn("⚠️ Background location permission not granted");
              Toast.show("Background location is required for tracking when screen is off", {
                type: "warning",
                duration: 4000,
              });
            }

            // Start foreground service for background location tracking
            // expo-location handles this automatically when watching position with background permission
            console.log("✅ Starting location tracking with foreground service");
            
            // Prompt user to disable battery optimization (only once, can be skipped)
            // We'll show this as a one-time prompt
            const batteryOptPromptShown = await AsyncStorage.getItem("batteryOptPromptShown");
            if (!batteryOptPromptShown && Platform.OS === "android") {
              setTimeout(() => {
                promptDisableBatteryOptimization();
                AsyncStorage.setItem("batteryOptPromptShown", "true");
              }, 2000); // Show after 2 seconds to not interrupt the status change
            }

            // If driver goes active, send current location immediately
            if (currentLocation && ws.current && ws.current.readyState === WebSocket.OPEN) {
              await sendLocationUpdate(currentLocation);
            }
          } catch (error) {
            console.error("Error starting location tracking:", error);
          }
        } else {
          // Driver going inactive - stop foreground service
          console.log("🛑 Stopping location tracking");
          // expo-location will handle stopping the foreground service automatically
          // when we stop watching position or when the app goes to background
          
          // Notify socket server when driver goes inactive
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            // Send a message to remove driver from available drivers
            const message = JSON.stringify({
              type: "driverStatusChange",
              role: "driver",
              driver: changeStatus.data.driver.id,
              status: "inactive",
            });
            ws.current.send(message);
          }
        }
        
        setloading(false);
      } else {
        setloading(false);
      }
    }
  }, [loading, isOn, currentLocation]);

  const sendPushNotification = async (expoPushToken: string, data: any) => {
    const message = {
      to: expoPushToken,
      sound: "default",
      title: "Ride Request Accepted!",
      body: `Your driver is on the way!`,
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
      Toast.show("Failed to accept ride. Please try again.", {
        type: "danger",
        duration: 3000,
      });
    } finally {
      setloading(false);
    }
  }, [loading, userData, distance, driver, currentLocationName, destinationLocationName, currentLocation, marker]);

  // Memoize expensive calculations to avoid recalculating on every render
  const estimatedFare = useMemo(() => {
    return distance ? (distance * parseInt(driver?.rate || "0")).toFixed(2) : "0.00";
  }, [distance, driver?.rate]);

  const estimatedDistance = useMemo(() => {
    return distance ? parseFloat(distance) : 0;
  }, [distance]);

  // Memoize map region to prevent unnecessary re-renders
  const memoizedRegion = useMemo(() => {
    return region;
  }, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  // Memoize map markers to prevent unnecessary re-renders
  const mapMarkers = useMemo(() => {
    return {
      destination: marker,
      pickup: currentLocation,
    };
  }, [marker?.latitude, marker?.longitude, currentLocation?.latitude, currentLocation?.longitude]);

  return (
    <View style={[external.fx_1, { backgroundColor: colors.background }]}>
      <Header isOn={isOn} toggleSwitch={() => handleStatusChange()} />
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
                backgroundColor: colors.background,
                maxHeight: "90%",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                New Ride Request
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 24, color: colors.text }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Map View - Larger */}
              <View style={{ height: windowHeight(300), borderRadius: 12, overflow: "hidden", marginBottom: spacing.lg, position: "relative" }}>
                <MapView
                  style={{ flex: 1 }}
                  region={memoizedRegion}
                  onRegionChangeComplete={useCallback((newRegion) => {
                    setRegion(newRegion);
                  }, [])}
                  onMapReady={useCallback(() => {
                    console.log("✅ Home screen map ready and loaded successfully");
                    setMapReady(true);
                    setMapLoading(false);
                    setMapError(null);
                  }, [])}
                  onError={useCallback((error) => {
                    console.error("❌ Home screen map error:", error);
                    setMapError(`Map error: ${error.message || "Unknown error"}`);
                    setMapLoading(false);
                  }, [])}
                  onDidFailLoadingMap={useCallback((error) => {
                    console.error("❌ Home screen map failed to load:", error);
                    setMapError(`Failed to load map: ${error.message || "Unknown error"}`);
                    setMapLoading(false);
                  }, [])}
                >
                  {mapMarkers.destination && (
                    <Marker
                      coordinate={mapMarkers.destination}
                      title="Destination"
                      pinColor={color.status.active}
                    />
                  )}
                  {mapMarkers.pickup && (
                    <Marker
                      coordinate={mapMarkers.pickup}
                      title="Pickup"
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
                      borderRadius: 8,
                      zIndex: 1000,
                    }}
                  >
                    <Text style={{ color: "white", fontSize: 12, fontWeight: "bold" }}>
                      Map Error: {mapError}
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
                    <Text style={{ color: "white", fontSize: 14 }}>Loading map...</Text>
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
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: spacing.lg,
                  marginBottom: spacing.lg,
                }}
              >
                <View style={{ flexDirection: "row", marginBottom: spacing.md }}>
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
                      {currentLocationName || "Pickup Location"}
                    </Text>
                    <View style={styles.border} />
                    <Text
                      style={[styles.drop, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {destinationLocationName || "Destination"}
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
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <ETADisplay distance={estimatedDistance} size="md" />
                  <View>
                    <Text
                      style={{
                        fontSize: fontSizes.FONT12,
                        fontFamily: fonts.regular,
                        color: color.text.secondary,
                        marginBottom: spacing.xs / 2,
                      }}
                    >
                      Estimated Fare
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
                <Button
                  title="Decline"
                  onPress={handleClose}
                  width="48%"
                  height={windowHeight(50)}
                  backgroundColor={color.semantic.error}
                />
                <Button
                  title={loading ? "Accepting..." : "Accept Ride"}
                  onPress={() => acceptRideHandler()}
                  width="48%"
                  height={windowHeight(50)}
                  disabled={loading}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
