import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("notifications");
  const { t: tc } = useTranslation("common");
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
          console.log(
            "⚠️ Already processing a notification, ignoring duplicate"
          );
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
          console.log(
            `⚠️ Notification ${uniqueId} already processed, ignoring duplicate`
          );
          return;
        }

        // Mark as processing
        isProcessingNotification.current = true;
        processedNotificationIds.current.add(uniqueId);

        // Clean up old IDs (keep only last 10)
        if (processedNotificationIds.current.size > 10) {
          const firstId = processedNotificationIds.current
            .values()
            .next().value;
          processedNotificationIds.current.delete(firstId);
        }

        console.log(
          "📬 Processing notification data:",
          JSON.stringify(notificationData, null, 2)
        );

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
            console.error(
              "❌ Error parsing notificationData as JSON:",
              parseError
            );
            return;
          }
        } else {
          orderData = notificationData;
        }

        console.log("📦 Final orderData:", JSON.stringify(orderData, null, 2));

        // Check if trip activation notification
        if (orderData && orderData.type === "tripActivation") {
          console.log("📬 Trip activation notification received:", orderData);
          Toast.show(
            t("tripNowAvailable", { tripName: orderData.tripName }),
            {
              type: "success",
              duration: 5000,
            }
          );
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
          Toast.show(t("invalidFormat"), {
            type: "danger",
          });
          return;
        }

        if (
          !orderData.currentLocation ||
          !orderData.marker ||
          !orderData.user
        ) {
          console.error(
            "❌ Invalid notification data - missing required fields"
          );
          Toast.show(
            t("invalidRideData"),
            {
              type: "danger",
            }
          );
          return;
        }

        // Call handler with parsed data
        handlers.onRideRequest({
          currentLocation: orderData.currentLocation,
          marker: orderData.marker,
          user: orderData.user,
          distance: orderData.distance || "0",
          currentLocationName:
            orderData.currentLocationName ||
            orderData.currentLocation?.name ||
            tc("pickupLocation"),
          destinationLocationName:
            orderData.destinationLocation ||
            orderData.destinationLocationName ||
            orderData.marker?.name ||
            tc("destination"),
          destinationLocation: orderData.destinationLocation,
        });
      } catch (error: any) {
        console.error("❌ Error processing notification data:", error);
        Toast.show(t("errorProcessingRide", { message: error.message }), {
          type: "danger",
          duration: 5000,
        });
      } finally {
        isProcessingNotification.current = false;
      }
    },
    [handlers, t, tc]
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

    checkAndRegister();

    appStateSubscription = require("react-native").AppState.addEventListener(
      "change",
      (nextAppState: string) => {
        if (nextAppState === "active" && isMounted) {
          console.log("📱 App came to foreground - refreshing push token...");
          checkAndRegister();
        }
      }
    );

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
          Toast.show(
            t("permissionsNotGranted"),
            {
              type: "danger",
              duration: 5000,
            }
          );
        } else {
          console.log("✅ Notification permissions granted");
        }
      })
      .catch((error) => {
        console.error("❌ Error checking notification permissions:", error);
      });

    // Foreground listener
    const foregroundSubscription =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("📱 ===== NOTIFICATION RECEIVED - LISTENER FIRED =====");

        if (isProcessingNotification.current) {
          console.log("⚠️ Already processing notification, ignoring");
          return;
        }

        Toast.show(t("newRideRequest"), {
          type: "success",
          duration: 3000,
        });

        try {
          const data = notification.request.content.data;
          if (!data) {
            console.error("❌ ERROR: No data in notification");
            Toast.show(t("noDataFound"), {
              type: "warning",
              duration: 3000,
            });
            return;
          }
          handleNotificationData(data, notification.request.identifier);
        } catch (error: any) {
          console.error("❌ ERROR: Exception in notification listener", error);
          Toast.show(t("errorGeneric", { message: error.message }), {
            type: "danger",
            duration: 5000,
          });
        }
      });

    // Response listener (when user taps notification)
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("👆 ===== NOTIFICATION TAPPED - APP OPENED =====");

        if (isProcessingNotification.current) {
          console.log(
            "⚠️ Already processing notification, ignoring tapped notification"
          );
          return;
        }

        Toast.show(t("tappedOpening"), {
          type: "info",
          duration: 3000,
        });

        try {
          // Safely extract data from notification response
          // This may fail if the response contains non-serializable objects like UserHandle
          let data;
          try {
            data = response.notification.request.content.data;
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
                Toast.show(
                  t("processManual"),
                  {
                    type: "warning",
                    duration: 5000,
                  }
                );
                return;
              }
            } else {
              throw serializationError;
            }
          }

          if (!data) {
            console.error("❌ No data found in tapped notification");
            Toast.show(t("tappedNoData"), {
              type: "warning",
              duration: 3000,
            });
            return;
          }

          // Delay processing to ensure app is fully initialized
          setTimeout(() => {
            handleNotificationData(
              data,
              response.notification.request.identifier
            );
          }, 500);
        } catch (error: any) {
          const errorMessage = error?.message || String(error);
          console.error("❌ Error handling tapped notification:", error);

          // Don't show error toast for serialization errors - they're expected
          if (
            !errorMessage.includes("UserHandle") &&
            !errorMessage.includes("Could not put") &&
            !errorMessage.includes("WritableMap")
          ) {
            Toast.show(
              t("errorTapped", { message: errorMessage }),
              {
                type: "danger",
                duration: 5000,
              }
            );
          }
        }
      });

    // Check if app was opened from notification
    // Delay this call to ensure app is fully initialized and avoid serialization errors
    setTimeout(() => {
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            console.log("🚀 ===== APP WAS OPENED FROM NOTIFICATION =====");

            if (isProcessingNotification.current) {
              console.log(
                "⚠️ Already processing notification, ignoring last notification"
              );
              return;
            }

            Toast.show(t("openedFromNotification"), {
              type: "info",
              duration: 3000,
            });

            try {
              // Safely extract data from notification response
              // This may fail if the response contains non-serializable objects like UserHandle
              let data;
              try {
                data = response.notification.request.content.data;
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
                    Toast.show(
                      t("processManual"),
                      {
                        type: "warning",
                        duration: 5000,
                      }
                    );
                    return;
                  }
                } else {
                  throw serializationError;
                }
              }

              if (data) {
                setTimeout(() => {
                  handleNotificationData(
                    data,
                    response.notification.request.identifier
                  );
                }, 1000);
              } else {
                console.error("❌ No data found in last notification");
                Toast.show(t("foundNoData"), {
                  type: "warning",
                  duration: 3000,
                });
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error);
              console.error("❌ Error handling last notification:", error);

              // Don't show error toast for serialization errors - they're expected
              if (
                !errorMessage.includes("UserHandle") &&
                !errorMessage.includes("Could not put") &&
                !errorMessage.includes("WritableMap")
              ) {
                Toast.show(
                  t("errorLast", { message: errorMessage }),
                  {
                    type: "danger",
                    duration: 5000,
                  }
                );
              }
            }
          } else {
            console.log("ℹ️ App opened normally (not from notification)");
          }
        })
        .catch((error: any) => {
          const errorMessage = error?.message || String(error);
          console.error("❌ Error checking last notification:", error);

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

    return () => {
      console.log("🧹 Cleaning up notification listeners");
      if (foregroundSubscription) {
        Notifications.removeNotificationSubscription(foregroundSubscription);
      }
      if (responseSubscription) {
        Notifications.removeNotificationSubscription(responseSubscription);
      }
    };
  }, [handleNotificationData, t]);

  // Register for push notifications function
  async function registerForPushNotificationsAsync() {
    console.log("🔔 ===== STARTING PUSH NOTIFICATION REGISTRATION =====");

    if (!isPhysicalDevice()) {
      console.warn(
        "⚠️ Not a physical device - push notifications not available"
      );
      Toast.show(t("physicalDeviceRequired"), {
        type: "danger",
      });
      return;
    }

    try {
      // Request permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.error("❌ Notification permissions not granted:", finalStatus);
        Toast.show(t("pushTokenFailed"), {
          type: "danger",
        });
        return;
      }

      console.log("✅ Notification permissions granted");

      // Get project ID
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) {
        console.error("❌ Project ID not found for push notifications");
        Toast.show(t("projectIdFailed"), {
          type: "danger",
        });
        return;
      }

      console.log("✅ Project ID found:", projectId);

      // Get Expo push token
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({ projectId })
      ).data;

      if (
        !pushTokenString ||
        !pushTokenString.startsWith("ExponentPushToken[")
      ) {
        console.error("❌ Invalid push token format:", pushTokenString);
        Toast.show(t("invalidPushToken"), {
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
                console.error(
                  "❌ Failed to save token: No access token after all retries"
                );
                Toast.show(t("loginToEnablePush"), {
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
              console.log(
                "✅ Token verification: MATCH - notifications should work!"
              );
              Toast.show(t("pushEnabled"), {
                type: "success",
                duration: 2000,
              });
            }
            return;
          } catch (error: any) {
            console.error(
              `❌ Error saving notification token (attempt ${i + 1}):`,
              error.message
            );
            if (error.response?.status === 401) {
              Toast.show(t("loginAgainNotifications"), {
                type: "warning",
                duration: 3000,
              });
              return;
            }
            if (i < retries - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, 2000 * (i + 1))
              );
            } else {
              console.error(
                "❌ Failed to save notification token after all retries"
              );
              Toast.show(
                t("tokenSaveFailed"),
                {
                  type: "warning",
                  duration: 5000,
                }
              );
            }
          }
        }
      };

      await saveTokenToDatabase();
    } catch (e: any) {
      console.error("Error getting push token:", e);
      const errorMessage = e?.message || String(e);
      const isFirebaseError =
        errorMessage.includes("FirebaseApp") ||
        errorMessage.includes("Firebase");

      if (isFirebaseError) {
        console.warn(
          "Firebase not initialized. Rebuild the app with expo-notifications plugin."
        );
      } else if (isPhysicalDevice()) {
        Toast.show(
          t("pushUnavailableRebuild"),
          {
            type: "warning",
            duration: 3000,
          }
        );
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
