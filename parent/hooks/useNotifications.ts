import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import api from "@/lib/api";

//Test

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const useNotifications = () => {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    registerForPushNotifications();

    // Listen for notifications while app is in foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
      });

    // Listen for user tapping on notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification response:", response);
        // Handle navigation based on notification data
        const data = response.notification.request.content.data;
        if (data?.tripId && data?.studentId) {
          // Navigate to trip tracking screen
          // This would require router access, so we'll handle it in the component
        }
      });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const registerForPushNotifications = async () => {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!");
        return;
      }

      // Get device push token (FCM token on Android, APNs token on iOS)
      // This works with Firebase and doesn't require Expo projectId
      try {
        let token: string;

        if (Platform.OS === "android") {
          // On Android, getDevicePushTokenAsync returns FCM token when Firebase is configured
          const tokenData = await Notifications.getDevicePushTokenAsync();
          token = tokenData.data;
        } else {
          // On iOS, use Expo push token (requires projectId) or device token
          const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ||
            Constants.expoConfig?.extra?.projectId;

          if (projectId) {
            const tokenData = await Notifications.getExpoPushTokenAsync({
              projectId: projectId,
            });
            token = tokenData.data;
          } else {
            // Fallback to device token on iOS if no projectId
            const tokenData = await Notifications.getDevicePushTokenAsync();
            token = tokenData.data;
          }
        }

        console.log("Push token:", token);

        // Send token to backend
        try {
          await api.put("/parent/notification-token", {
            notificationToken: token,
          });
        } catch (error) {
          console.error("Error updating notification token:", error);
        }
      } catch (tokenError: any) {
        // Handle Firebase initialization errors gracefully
        if (
          tokenError?.message?.includes("Firebase") ||
          tokenError?.message?.includes("FirebaseApp")
        ) {
          console.warn(
            "Firebase not initialized - push notifications may not work. This is expected if Firebase is not configured."
          );
          console.warn(
            "To enable push notifications, configure Firebase in your app or use Expo's push notification service."
          );
        } else {
          console.error("Error getting push token:", tokenError);
        }
        // Don't throw - allow app to continue without push notifications
        return;
      }

      if (Platform.OS === "android") {
        try {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
          });
        } catch (channelError) {
          console.warn("Error setting notification channel:", channelError);
        }
      }
    } catch (error) {
      // Catch all other errors and log them without crashing
      console.error("Error registering for push notifications:", error);
      // Don't rethrow - allow app to continue
    }
  };

  return {
    registerForPushNotifications,
  };
};
