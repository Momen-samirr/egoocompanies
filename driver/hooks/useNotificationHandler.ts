import { useCallback, useRef } from "react";
import { router } from "expo-router";
import { Toast } from "react-native-toast-notifications";
import { logger } from "@/lib/logger";

interface NotificationData {
  orderData?: any;
  user?: any;
  type?: string;
  tripName?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  marker?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  currentLocationName?: string;
  destinationLocationName?: string;
  destinationLocation?: string;
  distance?: string;
  user?: any;
}

interface RideRequestData {
  user: any;
  pickupLocation: { latitude: number; longitude: number };
  destinationLocation: { latitude: number; longitude: number };
  pickupLocationName: string;
  destinationLocationName: string;
  distance: string;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

interface UseNotificationHandlerOptions {
  onRideRequest?: (data: RideRequestData) => void;
  onTripActivation?: (data: { tripName: string; tripId?: string }) => void;
}

interface UseNotificationHandlerReturn {
  handleNotification: (
    notificationData: NotificationData,
    notificationId?: string
  ) => void;
  isProcessing: boolean;
}

/**
 * Custom hook for handling push notifications
 * Processes notification data and triggers appropriate actions
 */
export function useNotificationHandler(
  options: UseNotificationHandlerOptions = {}
): UseNotificationHandlerReturn {
  const { onRideRequest, onTripActivation } = options;
  const processedNotificationIds = useRef<Set<string>>(new Set());
  const isProcessingNotification = useRef<boolean>(false);

  const handleNotification = useCallback(
    (notificationData: NotificationData, notificationId?: string) => {
      try {
        // Prevent concurrent processing of notifications
        if (isProcessingNotification.current) {
          logger.debug("Already processing a notification, ignoring duplicate");
          return;
        }

        // Create a unique ID for this notification
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

        // Check if this notification was already processed
        if (processedNotificationIds.current.has(uniqueId)) {
          logger.debug(
            `Notification ${uniqueId} already processed, ignoring duplicate`
          );
          return;
        }

        // Mark as processing
        isProcessingNotification.current = true;
        processedNotificationIds.current.add(uniqueId);

        // Clean up old notification IDs (keep only last 10 to prevent memory leak)
        if (processedNotificationIds.current.size > 10) {
          const firstId = processedNotificationIds.current
            .values()
            .next().value;
          processedNotificationIds.current.delete(firstId);
        }

        logger.info("Processing notification data", {
          notificationId: uniqueId,
        });

        // Extract orderData from notification
        let orderData: any;

        if (notificationData && notificationData.orderData) {
          if (typeof notificationData.orderData === "string") {
            try {
              orderData = JSON.parse(notificationData.orderData);
              logger.debug("Parsed orderData from string");
            } catch (parseError) {
              logger.error("Error parsing orderData string", parseError);
              orderData = notificationData.orderData;
            }
          } else {
            orderData = notificationData.orderData;
            logger.debug("Using orderData as object");
          }
        } else if (typeof notificationData === "string") {
          try {
            orderData = JSON.parse(notificationData);
            logger.debug("Parsed entire notificationData as JSON");
          } catch (parseError) {
            logger.error("Error parsing notificationData as JSON", parseError);
            return;
          }
        } else {
          orderData = notificationData;
          logger.debug("Using notificationData directly as orderData");
        }

        logger.debug("Final orderData", { hasOrderData: !!orderData });

        // Check if this is a trip activation notification
        if (orderData && orderData.type === "tripActivation") {
          logger.info("Trip activation notification received", orderData);
          Toast.show(
            `Trip "${orderData.tripName}" is now available to start!`,
            {
              type: "success",
              duration: 5000,
            }
          );

          if (onTripActivation) {
            onTripActivation({
              tripName: orderData.tripName,
              tripId: orderData.tripId,
            });
          } else {
            // Navigate to scheduled trips screen
            setTimeout(() => {
              router.push("/(routes)/scheduled-trips");
            }, 2000);
          }
          return;
        }

        // Validate required fields for ride request
        if (!orderData) {
          logger.error("No orderData found in notification");
          Toast.show("Invalid notification format", {
            type: "danger",
          });
          return;
        }

        if (
          !orderData.currentLocation ||
          !orderData.marker ||
          !orderData.user
        ) {
          logger.error("Invalid notification data - missing required fields", {
            hasCurrentLocation: !!orderData.currentLocation,
            hasMarker: !!orderData.marker,
            hasUser: !!orderData.user,
          });
          Toast.show(
            "Invalid ride request data - missing location or user info",
            {
              type: "danger",
            }
          );
          return;
        }

        // Prepare ride request data
        const pickupLocation = {
          latitude: orderData.currentLocation.latitude,
          longitude: orderData.currentLocation.longitude,
        };

        const destinationLocation = {
          latitude: orderData.marker.latitude,
          longitude: orderData.marker.longitude,
        };

        // Calculate region
        const latDelta =
          Math.abs(pickupLocation.latitude - destinationLocation.latitude) * 2;
        const lonDelta =
          Math.abs(pickupLocation.longitude - destinationLocation.longitude) *
          2;

        const distance = parseFloat(orderData.distance || "0");
        const estimatedFare = orderData.estimatedFare || "0.00"; // Will be calculated in home screen if needed

        const rideRequestData: RideRequestData = {
          user: orderData.user,
          pickupLocation,
          destinationLocation,
          pickupLocationName:
            orderData.currentLocationName ||
            orderData.currentLocation?.name ||
            "Pickup Location",
          destinationLocationName:
            orderData.destinationLocation ||
            orderData.destinationLocationName ||
            orderData.marker?.name ||
            "Destination",
          distance: orderData.distance || "0",
          estimatedFare,
          estimatedDistance: distance,
          region: {
            latitude:
              (pickupLocation.latitude + destinationLocation.latitude) / 2,
            longitude:
              (pickupLocation.longitude + destinationLocation.longitude) / 2,
            latitudeDelta: Math.max(latDelta, 0.0922),
            longitudeDelta: Math.max(lonDelta, 0.0421),
          },
        };

        logger.info("Ride request data prepared successfully", {
          user: orderData.user?.name,
          distance: orderData.distance,
        });

        // Call the callback or use default behavior
        if (onRideRequest) {
          onRideRequest(rideRequestData);
        } else {
          // Default: show toast and log
          Toast.show("New ride request received!", {
            type: "success",
            duration: 3000,
          });
          logger.info("Ride request notification processed", rideRequestData);
        }
      } catch (error: any) {
        logger.error("Error processing notification data", error, {
          notificationData,
        });
        Toast.show(`Error processing ride request: ${error.message}`, {
          type: "danger",
          duration: 5000,
        });
      } finally {
        // Always reset processing flag
        isProcessingNotification.current = false;
      }
    },
    [onRideRequest, onTripActivation]
  );

  return {
    handleNotification,
    isProcessing: isProcessingNotification.current,
  };
}

