import { useEffect, useRef, useState } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getServerUri } from "@/configs/constants";
import { Toast } from "react-native-toast-notifications";
import { logger } from "@/lib/logger";

interface UsePushNotificationsOptions {
  driverId?: string;
  enabled?: boolean;
}

interface UsePushNotificationsReturn {
  token: string | null;
  isRegistered: boolean;
  error: string | null;
  register: () => Promise<void>;
}

/**
 * Custom hook for managing push notification registration
 * Handles token generation, registration, and updates
 */
export function usePushNotifications(
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsReturn {
  const { driverId, enabled = true } = options;
  const [token, setToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegisteringToken = useRef<boolean>(false);
  const tokenRegistrationCompleted = useRef<boolean>(false);
  const lastSavedToken = useRef<string | null>(null);
  const appStateRegistrationTimeout = useRef<NodeJS.Timeout | null>(null);

  // Safe wrapper to check if device is physical
  const isPhysicalDevice = (): boolean => {
    // On Android, assume physical device to allow push notifications
    if (Platform.OS === "android") {
      return true;
    }
    return true;
  };

  const registerForPushNotificationsAsync = async (): Promise<void> => {
    // Early return guard: Prevent concurrent registrations
    if (isRegisteringToken.current) {
      logger.debug(
        "Token registration already in progress, skipping duplicate call"
      );
      return;
    }

    isRegisteringToken.current = true;

    try {
      logger.info("Starting push notification registration");

      if (!isPhysicalDevice()) {
        logger.warn("Not a physical device - push notifications not available");
        Toast.show("Must use physical device for Push Notifications", {
          type: "danger",
        });
        isRegisteringToken.current = false;
        return;
      }

      // Step 1: Request/check notification permissions
      logger.debug("Checking notification permissions");
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        logger.debug("Requesting notification permissions");
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        logger.error("Notification permissions not granted", {
          status: finalStatus,
        });
        Toast.show("Failed to get push token for push notification!", {
          type: "danger",
        });
        setError("Notification permissions not granted");
        isRegisteringToken.current = false;
        return;
      }

      logger.info("Notification permissions granted");

      // Step 2: Get project ID
      logger.debug("Getting project ID");
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) {
        logger.error("Project ID not found for push notifications", {
          expoConfig: Constants?.expoConfig,
          easConfig: Constants?.easConfig,
        });
        Toast.show("Failed to get project id for push notification!", {
          type: "danger",
        });
        setError("Project ID not found");
        isRegisteringToken.current = false;
        return;
      }

      logger.info("Project ID found", { projectId });

      // Step 3: Get Expo push token
      logger.debug("Getting Expo push token");
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      if (!pushTokenString) {
        logger.error("Failed to get push token - token is null/undefined");
        Toast.show("Failed to get push token", {
          type: "danger",
        });
        setError("Failed to get push token");
        isRegisteringToken.current = false;
        return;
      }

      // Validate token format
      if (!pushTokenString.startsWith("ExponentPushToken[")) {
        logger.error("Invalid push token format", { token: pushTokenString });
        Toast.show("Invalid push token format", {
          type: "danger",
        });
        setError("Invalid push token format");
        isRegisteringToken.current = false;
        return;
      }

      logger.info("Push token obtained successfully", {
        tokenFormat: "Valid",
        projectId,
        platform: Platform.OS,
      });

      // Early return guard: Check if this token was already saved
      if (lastSavedToken.current === pushTokenString) {
        logger.debug("Token already saved previously, skipping save operation");
        tokenRegistrationCompleted.current = true;
        setToken(pushTokenString);
        setIsRegistered(true);
        isRegisteringToken.current = false;
        return;
      }

      // Save notification token to database
      const saveTokenToDatabase = async (retries = 10): Promise<void> => {
        logger.info("Starting token save process");

        for (let i = 0; i < retries; i++) {
          try {
            logger.debug(
              `Attempting to save token (attempt ${i + 1}/${retries})`
            );

            // Wait a bit longer on first few attempts to ensure driver is logged in
            if (i > 0) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            const accessToken = await AsyncStorage.getItem("accessToken");

            if (!accessToken) {
              logger.warn(`Access token not available (attempt ${i + 1})`);
              if (i < retries - 1) {
                continue;
              } else {
                logger.error(
                  "Failed to save token: No access token after all retries"
                );
                Toast.show("Please log in to enable push notifications", {
                  type: "warning",
                  duration: 3000,
                });
                setError("Driver must be logged in to save notification token");
                return;
              }
            }

            if (!pushTokenString) {
              logger.error("Failed to save token: No push token");
              setError("No push token");
              return;
            }

            logger.debug("Sending token to server", {
              serverUrl: `${getServerUri()}/driver/update-notification-token`,
            });

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

            logger.info("Notification token saved successfully", {
              serverResponse: response.data,
            });

            // Verify token matches
            if (response.data?.driver?.notificationToken === pushTokenString) {
              logger.info(
                "Token verification: MATCH - notifications should work"
              );

              const isNewToken = lastSavedToken.current !== pushTokenString;
              if (isNewToken) {
                Toast.show("Push notifications enabled!", {
                  type: "success",
                  duration: 2000,
                });
              }

              lastSavedToken.current = pushTokenString;
              tokenRegistrationCompleted.current = true;
              setToken(pushTokenString);
              setIsRegistered(true);
              setError(null);
              return;
            } else {
              logger.error("Token verification: MISMATCH", {
                expected: pushTokenString,
                received: response.data?.driver?.notificationToken,
              });
            }

            return;
          } catch (error: any) {
            logger.error(
              `Error saving notification token (attempt ${i + 1})`,
              error,
              {
                status: error.response?.status,
                code: error.code,
              }
            );

            if (error.response?.status === 401) {
              logger.error("Unauthorized - access token may be invalid");
              Toast.show("Please log in again to enable notifications", {
                type: "warning",
                duration: 3000,
              });
              setError("Unauthorized");
              return;
            }

            if (i < retries - 1) {
              const delay = 2000 * (i + 1);
              logger.debug(`Waiting ${delay}ms before retry...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
              logger.error(
                "Failed to save notification token after all retries"
              );
              Toast.show(
                "Failed to save notification token. Please check your connection and try again.",
                {
                  type: "warning",
                  duration: 5000,
                }
              );
              setError("Failed to save token after retries");
            }
          }
        }
      };

      await saveTokenToDatabase().catch((err) => {
        logger.error("Unexpected error in token save process", err);
      });
    } catch (e: any) {
      logger.error("Error getting push token", e);

      const errorMessage = e?.message || String(e);
      const isFirebaseError =
        errorMessage.includes("FirebaseApp") ||
        errorMessage.includes("Firebase");

      if (isFirebaseError) {
        logger.warn("Firebase not initialized", {
          message: "The app needs to be rebuilt with expo-notifications plugin",
        });
      } else if (isPhysicalDevice()) {
        Toast.show(
          "Push notifications may not be available. Please rebuild the app.",
          {
            type: "warning",
            duration: 3000,
          }
        );
      }
      setError(errorMessage);
    } finally {
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
  };

  // Register when driver ID is available and enabled
  useEffect(() => {
    if (!enabled || !driverId) {
      return;
    }

    let isMounted = true;
    let appStateSubscription: any = null;

    const checkAndRegister = async () => {
      if (!isMounted) return;

      if (isRegisteringToken.current) {
        logger.debug("Token registration already in progress, skipping...");
        return;
      }

      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        if (accessToken) {
          logger.info(
            "Driver is logged in - registering for push notifications"
          );
          await registerForPushNotificationsAsync();
        } else {
          logger.warn(
            "Driver not logged in - skipping push notification registration"
          );
        }
      } catch (error) {
        logger.error("Error checking access token", error);
      }
    };

    // Register immediately when driver data is loaded
    checkAndRegister();

    // Also register when app comes to foreground
    appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active" && isMounted) {
          if (appStateRegistrationTimeout.current) {
            clearTimeout(appStateRegistrationTimeout.current);
          }

          appStateRegistrationTimeout.current = setTimeout(() => {
            if (isMounted && !isRegisteringToken.current) {
              logger.debug("App came to foreground - checking push token");
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
  }, [driverId, enabled]);

  return {
    token,
    isRegistered,
    error,
    register: registerForPushNotificationsAsync,
  };
}

