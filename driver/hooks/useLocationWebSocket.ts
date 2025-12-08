import { useEffect, useRef, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getWebSocketUrl, getServerUri } from "@/configs/constants";
import { setWebSocketConnection } from "@/services/backgroundLocationTask";
import { updateDriverLocation } from "@/services/locationService";
import { logger } from "@/lib/logger";

interface Location {
  latitude: number;
  longitude: number;
  heading?: number;
}

interface UseLocationWebSocketOptions {
  isActive: boolean;
  currentLocation: Location | null;
  onLocationUpdate?: (location: Location) => void;
}

interface UseLocationWebSocketReturn {
  ws: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
  sendLocationUpdate: (location: Location) => Promise<boolean>;
  sendLocationUpdateWithRetry: (location: Location, retryCount?: number, maxRetries?: number) => Promise<boolean>;
}

/**
 * Custom hook for managing WebSocket connection and location updates
 * Handles WebSocket connection, reconnection, and location update sending
 */
export function useLocationWebSocket(
  options: UseLocationWebSocketOptions
): UseLocationWebSocketReturn {
  const { isActive, currentLocation, onLocationUpdate } = options;
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectDelay = 3000;
  const isActiveRef = useRef(isActive);

  // Keep ref in sync
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const sendLocationUpdate = useCallback(
    async (location: Location): Promise<boolean> => {
      const currentIsActive = isActiveRef.current;
      if (!currentIsActive) {
        logger.debug("Driver is inactive - skipping location update");
        return false;
      }

      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        logger.warn("WebSocket not connected - cannot send location update");
        return false;
      }

      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        if (!accessToken) {
          logger.error("No access token - cannot fetch driver data");
          return false;
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

          // Send to WebSocket
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
          logger.debug("Location update sent via WebSocket", {
            driverId: driverData.id,
            location: { lat: location.latitude, lng: location.longitude },
          });

          // Also update location for scheduled trips
          try {
            const response = await updateDriverLocation({
              latitude: location.latitude,
              longitude: location.longitude,
            });

            if (response.success && response.activationChecks) {
              const availableTrips = response.activationChecks.filter(
                (check: any) => check.canActivate
              );
              if (availableTrips.length > 0) {
                logger.info(`${availableTrips.length} trip(s) are now available to start`);
              }
            }
          } catch (error: any) {
            if (
              error.response?.status === 400 &&
              error.response?.data?.message?.includes("online")
            ) {
              logger.debug("Location update skipped - driver is offline");
            } else {
              logger.warn("Failed to update location for scheduled trips", error);
            }
          }

          if (onLocationUpdate) {
            onLocationUpdate(location);
          }

          return true;
        }

        return false;
      } catch (error: any) {
        logger.error("Error sending location update", error);
        return false;
      }
    },
    [onLocationUpdate]
  );

  const connectWebSocket = useCallback(() => {
    const wsUrl = getWebSocketUrl();
    logger.info(`Attempting to connect to WebSocket: ${wsUrl}`, {
      attempt: reconnectAttemptsRef.current + 1,
    });

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        logger.info("Connected to WebSocket server successfully", {
          url: wsUrl,
          driverStatus: isActiveRef.current,
        });
        setConnected(true);
        reconnectAttemptsRef.current = 0;
        setWebSocketConnection(ws.current);

        // If driver is already active and we have a location, send it immediately
        if (isActiveRef.current && currentLocation) {
          logger.debug("Driver is active and has location - sending immediately");
          sendLocationUpdate(currentLocation);
        }
      };

      ws.current.onmessage = (e) => {
        try {
          if (typeof e.data === "string") {
            const message = JSON.parse(e.data);
            logger.debug("Received WebSocket message", message);
          } else {
            logger.debug("Received ping/pong frame");
          }
        } catch (error) {
          logger.error("Error parsing WebSocket message", error);
        }
      };

      ws.current.onerror = (e: any) => {
        const errorMsg = e.message || "Unknown error";
        logger.error(`WebSocket error: ${errorMsg}`, e);
        setConnected(false);
      };

      ws.current.onclose = (e) => {
        const wasClean = e.wasClean !== undefined ? e.wasClean : false;
        logger.info("WebSocket closed", {
          code: e.code,
          reason: e.reason || "No reason provided",
          wasClean,
        });
        setConnected(false);

        // Attempt to reconnect
        const shouldReconnect =
          !wasClean &&
          e.code !== 1000 &&
          e.code !== 1001 &&
          reconnectAttemptsRef.current < maxReconnectAttempts;

        if (shouldReconnect) {
          reconnectAttemptsRef.current++;
          logger.info(
            `Will attempt to reconnect in ${reconnectDelay / 1000} seconds`,
            {
              attempt: reconnectAttemptsRef.current,
              maxAttempts: maxReconnectAttempts,
            }
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            logger.debug(`Attempting reconnection ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
            connectWebSocket();
          }, reconnectDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          logger.error(
            `Max reconnection attempts (${maxReconnectAttempts}) reached`,
            {
              lastCloseCode: e.code,
              wasClean,
            }
          );
        } else if (wasClean) {
          logger.info(`Connection closed cleanly (code ${e.code}). Not reconnecting.`);
        }
      };
    } catch (error: any) {
      logger.error("Failed to create WebSocket", error);
      setConnected(false);

      // Retry connection
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, reconnectDelay);
      }
    }
  }, [currentLocation, sendLocationUpdate]);

  // Initial connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        logger.debug("Cleaning up WebSocket connection");
        setWebSocketConnection(null);
        ws.current.close();
        ws.current = null;
      }
    };
  }, []); // Only run on mount/unmount

  // Send location update when driver becomes active and WebSocket connects
  useEffect(() => {
    if (connected && isActive && currentLocation) {
      logger.debug("WebSocket connected and driver active - sending location");
      sendLocationUpdate(currentLocation);
    }
  }, [connected, isActive, currentLocation, sendLocationUpdate]);

  const sendLocationUpdateWithRetry = useCallback(
    async (
      location: Location,
      retryCount = 0,
      maxRetries = 3
    ): Promise<boolean> => {
      const currentIsOn = isActiveRef.current;
      if (!currentIsOn) {
        logger.debug("Driver is inactive - skipping location update");
        return false;
      }

      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        if (retryCount < maxRetries) {
          logger.debug(
            `WebSocket not ready, retrying in 1 second... (${retryCount + 1}/${maxRetries})`
          );
          setTimeout(() => {
            sendLocationUpdateWithRetry(location, retryCount + 1, maxRetries);
          }, 1000);
          return false;
        } else {
          logger.warn("WebSocket not connected after max retries - cannot send location update");
          return false;
        }
      }

      return await sendLocationUpdate(location);
    },
    [sendLocationUpdate]
  );

  return {
    ws,
    connected,
    sendLocationUpdate,
    sendLocationUpdateWithRetry,
  };
}

