import { useEffect, useRef, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { Toast } from "react-native-toast-notifications";
import { router } from "expo-router";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import axios from "axios";
import { getServerUri } from "@/configs/constants";

export interface RideRequestData {
  currentLocation: { latitude: number; longitude: number; name?: string };
  marker: { latitude: number; longitude: number; name?: string };
  user: any;
  distance?: string;
  currentLocationName?: string;
  destinationLocationName?: string;
  destinationLocation?: string;
}

export interface NotificationHandlers {
  onRideRequest: (data: RideRequestData) => void;
  onTripActivation?: (tripName: string) => void;
}

/**
 * Custom hook for handling push notifications
 * Manages notification registration, listeners, and processing
 */
export function useNotifications(handlers: NotificationHandlers) {
  const processedNotificationIds = useRef<Set<string>>(new Set());
  const isProcessingNotification = useRef<boolean>(false);

  // Safe wrapper to check if device is physical
  const isPhysicalDevice = useCallback((): boolean => {
    if (Platform.OS === "android") {
      return true; // Assume physical device on Android
    }
    return true;
  }, []);

  // Helper function to handle notification data
  const handleNotificationData = useCallback(
    (notificationData: any, notificationId?: string) => {
      try {
        // Prevent concurrent processing
        if (isProcessingNotification.current) {
          console.log("⚠️ Already processing a notification, ignoring duplicate");
          return;
        }

        // Create unique ID
        let uniqueId: string;
        if (notificationId) {
          uniqueId = notificationId;
        } else {
          const userPhone =
            notificationData?.orderData?.user?.phone_number ||
            notificationData?.user?.phone_number ||
            notificationData?.orderData?.user?.id ||
            notificationData?.user?.id ||
            Date.now().toString();
          uniqueId = `notification_${userPhone}_${Date.now()}`;
        }

        // Check if already processed
        if (processedNotificationIds.current.has(uniqueId)) {
          console.log(`⚠️ Notification ${uniqueId} already processed, ignoring duplicate`);
          return;
        }

        // Mark as processing
        isProcessingNotification.current = true;
        processedNotificationIds.current.add(uniqueId);

        // Clean up old IDs (keep only last 10)
        if (processedNotificationIds.current.size > 10) {
          const firstId = processedNotificationIds.current.values().next().value;
          processedNotificationIds.current.delete(firstId);
        }

        console.log("📬 Processing notification data:", JSON.stringify(notificationData, null, 2));

        // Parse orderData
        let orderData;
        if (notificationData && notificationData.orderData) {
          if (typeof notificationData.orderData === "string") {
            try {
              orderData = JSON.parse(notificationData.orderData);
            } catch (parseError) {
              orderData = notificationData.orderData;
            }
          } else {
            orderData = notificationData.orderData;
          }
        } else if (typeof notificationData === "string") {
          try {
            orderData = JSON.parse(notificationData);
          } catch (parseError) {
            console.error("❌ Error parsing notificationData as JSON:", parseError);
            return;
          }
        } else {
          orderData = notificationData;
        }

        console.log("📦 Final orderData:", JSON.stringify(orderData, null, 2));

        // Check if trip activation notification
        if (orderData && orderData.type === "tripActivation") {
          console.log("📬 Trip activation notification received:", orderData);
          Toast.show(`Trip "${orderData.tripName}" is now available to start!`, {
            type: "success",
            duration: 5000,
          });
          if (handlers.onTripActivation) {
            handlers.onTripActivation(orderData.tripName);
          } else {
            setTimeout(() => {
              router.push("/(routes)/scheduled-trips");
            }, 2000);
          }
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
          Toast.show("Invalid ride request data - missing location or user info", {
            type: "danger",
          });
          return;
        }

        // Call handler with parsed data
        handlers.onRideRequest({
          currentLocation: orderData.currentLocation,
          marker: orderData.marker,
          user: orderData.user,
          distance: orderData.distance || "0",
          currentLocationName:
            orderData.currentLocationName || orderData.currentLocation?.name || "Pickup Location",
          destinationLocationName:
            orderData.destinationLocation ||
            orderData.destinationLocationName ||
            orderData.marker?.name ||
            "Destination",
          destinationLocation: orderData.destinationLocation,
        });
      } catch (error: any) {
        console.error("❌ Error processing notification data:", error);
        Toast.show(`Error processing ride request: ${error.message}`, {
          type: "danger",
          duration: 5000,
        });
      } finally {
        isProcessingNotification.current = false;
      }
    },
    [handlers]
  );

  // Register for push notifications
  useEffect(() => {
    let isMounted = true;
    let appStateSubscription: any = null;

    const checkAndRegister = async () => {
      if (!isMounted) return;

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

    checkAndRegister();

    appStateSubscription = require("react-native").AppState.addEventListener("change", (nextAppState: string) => {
      if (nextAppState === "active" && isMounted) {
        console.log("📱 App came to foreground - refreshing push token...");
        checkAndRegister();
      }
    });

    return () => {
      isMounted = false;
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
    };
  }, []);

  // Set up notification handler
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        console.log("🔔 ===== NOTIFICATION HANDLER CALLED =====");
        return {
          shouldShowAlert: false, // Let JavaScript handle it
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      },
    });
  }, []);

  // Set up notification listeners
  useEffect(() => {
    console.log("🔔 ===== SETTING UP NOTIFICATION LISTENERS =====");

    // Verify permissions
    Notifications.getPermissionsAsync()
      .then((permissions) => {
        if (!permissions.granted) {
          console.error("❌ Notification permissions not granted!");
          Toast.show("Notification permissions not granted. Please enable notifications in settings.", {
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

    // Foreground listener
    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log("📱 ===== NOTIFICATION RECEIVED - LISTENER FIRED =====");

      if (isProcessingNotification.current) {
        console.log("⚠️ Already processing notification, ignoring");
        return;
      }

      Toast.show("📱 New ride request received!", {
        type: "success",
        duration: 3000,
      });

      try {
        const data = notification.request.content.data;
        if (!data) {
          console.error("❌ ERROR: No data in notification");
          Toast.show("Notification received but no data found", {
            type: "warning",
            duration: 3000,
          });
          return;
        }
        handleNotificationData(data, notification.request.identifier);
      } catch (error: any) {
        console.error("❌ ERROR: Exception in notification listener", error);
        Toast.show(`Error: ${error.message}`, {
          type: "danger",
          duration: 5000,
        });
      }
    });

    // Response listener (when user taps notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("👆 ===== NOTIFICATION TAPPED - APP OPENED =====");

      if (isProcessingNotification.current) {
        console.log("⚠️ Already processing notification, ignoring tapped notification");
        return;
      }

      Toast.show("👆 Notification tapped - opening app...", {
        type: "info",
        duration: 3000,
      });

      try {
        const data = response.notification.request.content.data;
        if (!data) {
          console.error("❌ No data found in tapped notification");
          Toast.show("Notification tapped but no data found", {
            type: "warning",
            duration: 3000,
          });
          return;
        }
        setTimeout(() => {
          handleNotificationData(data, response.notification.request.identifier);
        }, 500);
      } catch (error: any) {
        console.error("❌ Error handling tapped notification:", error);
        Toast.show(`Error processing tapped notification: ${error.message}`, {
          type: "danger",
          duration: 5000,
        });
      }
    });

    // Check if app was opened from notification
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          console.log("🚀 ===== APP WAS OPENED FROM NOTIFICATION =====");

          if (isProcessingNotification.current) {
            console.log("⚠️ Already processing notification, ignoring last notification");
            return;
          }

          Toast.show("🚀 App opened from notification", {
            type: "info",
            duration: 3000,
          });

          try {
            const data = response.notification.request.content.data;
            if (data) {
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
      });

    return () => {
      console.log("🧹 Cleaning up notification listeners");
      if (foregroundSubscription) {
        Notifications.removeNotificationSubscription(foregroundSubscription);
      }
      if (responseSubscription) {
        Notifications.removeNotificationSubscription(responseSubscription);
      }
    };
  }, [handleNotificationData]);

  // Register for push notifications function
  async function registerForPushNotificationsAsync() {
    console.log("🔔 ===== STARTING PUSH NOTIFICATION REGISTRATION =====");

    if (!isPhysicalDevice()) {
      console.warn("⚠️ Not a physical device - push notifications not available");
      Toast.show("Must use physical device for Push Notifications", {
        type: "danger",
      });
      return;
    }

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.error("❌ Notification permissions not granted:", finalStatus);
        Toast.show("Failed to get push token for push notification!", {
          type: "danger",
        });
        return;
      }

      console.log("✅ Notification permissions granted");

      // Get project ID
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

      if (!projectId) {
        console.error("❌ Project ID not found for push notifications");
        Toast.show("Failed to get project id for push notification!", {
          type: "danger",
        });
        return;
      }

      console.log("✅ Project ID found:", projectId);

      // Get Expo push token
      const pushTokenString = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

      if (!pushTokenString || !pushTokenString.startsWith("ExponentPushToken[")) {
        console.error("❌ Invalid push token format:", pushTokenString);
        Toast.show("Invalid push token format", {
          type: "danger",
        });
        return;
      }

      console.log("✅ ===== PUSH TOKEN OBTAINED SUCCESSFULLY =====");
      console.log("✅ Token:", pushTokenString);

      // Save token to database
      const saveTokenToDatabase = async (retries = 10) => {
        for (let i = 0; i < retries; i++) {
          try {
            if (i > 0) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            const accessToken = await AsyncStorage.getItem("accessToken");
            if (!accessToken) {
              if (i < retries - 1) {
                continue;
              } else {
                console.error("❌ Failed to save token: No access token after all retries");
                Toast.show("Please log in to enable push notifications", {
                  type: "warning",
                  duration: 3000,
                });
                return;
              }
            }

            const response = await axios.put(
              `${getServerUri()}/driver/update-notification-token`,
              {
                notificationToken: pushTokenString,
              },
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
                timeout: 10000,
              }
            );

            console.log("✅ ===== NOTIFICATION TOKEN SAVED SUCCESSFULLY =====");
            if (response.data?.driver?.notificationToken === pushTokenString) {
              console.log("✅ Token verification: MATCH - notifications should work!");
              Toast.show("Push notifications enabled!", {
                type: "success",
                duration: 2000,
              });
            }
            return;
          } catch (error: any) {
            console.error(`❌ Error saving notification token (attempt ${i + 1}):`, error.message);
            if (error.response?.status === 401) {
              Toast.show("Please log in again to enable notifications", {
                type: "warning",
                duration: 3000,
              });
              return;
            }
            if (i < retries - 1) {
              await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
            } else {
              console.error("❌ Failed to save notification token after all retries");
              Toast.show("Failed to save notification token. Please check your connection and try again.", {
                type: "warning",
                duration: 5000,
              });
            }
          }
        }
      };

      await saveTokenToDatabase();
    } catch (e: any) {
      console.error("Error getting push token:", e);
      const errorMessage = e?.message || String(e);
      const isFirebaseError = errorMessage.includes("FirebaseApp") || errorMessage.includes("Firebase");

      if (isFirebaseError) {
        console.warn("Firebase not initialized. Rebuild the app with expo-notifications plugin.");
      } else if (isPhysicalDevice()) {
        Toast.show("Push notifications may not be available. Please rebuild the app.", {
          type: "warning",
          duration: 3000,
        });
      }
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

  return {
    isProcessingNotification: isProcessingNotification.current,
  };
}

