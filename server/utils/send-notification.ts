import axios from "axios";
import prisma from "./prisma";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

/**
 * Send a push notification to a captain about trip activation
 * @param captainId The ID of the captain to notify
 * @param tripId The scheduled trip ID
 * @returns Success status and message
 */
export async function sendTripActivationNotification(
  captainId: string,
  tripId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get captain and trip data
    const [captain, trip] = await Promise.all([
      prisma.driver.findUnique({
        where: { id: captainId },
        select: { notificationToken: true, name: true },
      }),
      prisma.scheduledTrip.findUnique({
        where: { id: tripId },
        select: { name: true },
      }),
    ]);

    if (!captain) {
      return {
        success: false,
        message: "Captain not found",
      };
    }

    if (!trip) {
      return {
        success: false,
        message: "Trip not found",
      };
    }

    if (!captain.notificationToken) {
      return {
        success: false,
        message: "Captain has no notification token",
      };
    }

    // Validate token format
    if (!captain.notificationToken.startsWith("ExponentPushToken[")) {
      return {
        success: false,
        message: "Invalid notification token format",
      };
    }

    // Prepare notification message
    // Note: Expo push notifications require data to be sent as orderData for compatibility
    const message = {
      to: captain.notificationToken,
      sound: "default",
      title: "Trip Available",
      body: `Your scheduled trip "${trip.name}" is now available to start!`,
      data: {
        orderData: JSON.stringify({
          type: "tripActivation",
          tripId: tripId,
          tripName: trip.name,
        }),
      },
      priority: "high",
    };

    // Send notification via Expo push service
    const response = await axios.post(EXPO_PUSH_ENDPOINT, message, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    if (response.data?.data?.status === "ok") {
      console.log(`✅ Trip activation notification sent to captain ${captainId}`);
      return {
        success: true,
        message: "Notification sent successfully",
      };
    } else {
      console.error("❌ Expo push service returned error:", response.data);
      return {
        success: false,
        message: "Failed to send notification",
      };
    }
  } catch (error: any) {
    console.error("Error sending trip activation notification:", error);
    return {
      success: false,
      message: error.message || "Error sending notification",
    };
  }
}

/**
 * Send a generic push notification to a captain
 * @param captainId The ID of the captain to notify
 * @param title Notification title
 * @param body Notification body
 * @param data Additional data to include
 * @returns Success status and message
 */
export async function sendNotificationToCaptain(
  captainId: string,
  title: string,
  body: string,
  data?: any
): Promise<{ success: boolean; message: string }> {
  try {
    const captain = await prisma.driver.findUnique({
      where: { id: captainId },
      select: { notificationToken: true, name: true },
    });

    if (!captain) {
      return {
        success: false,
        message: "Captain not found",
      };
    }

    if (!captain.notificationToken) {
      return {
        success: false,
        message: "Captain has no notification token",
      };
    }

    if (!captain.notificationToken.startsWith("ExponentPushToken[")) {
      return {
        success: false,
        message: "Invalid notification token format",
      };
    }

    const message = {
      to: captain.notificationToken,
      sound: "default",
      title,
      body,
      data: data || {},
      priority: "high",
    };

    const response = await axios.post(EXPO_PUSH_ENDPOINT, message, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    if (response.data?.data?.status === "ok") {
      return {
        success: true,
        message: "Notification sent successfully",
      };
    } else {
      return {
        success: false,
        message: "Failed to send notification",
      };
    }
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return {
      success: false,
      message: error.message || "Error sending notification",
    };
  }
}

