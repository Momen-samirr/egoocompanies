import { useEffect, useState, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { logger } from "@/lib/logger";
import { offlineQueue } from "@/lib/offlineQueue";
import { getServerUri } from "@/configs/constants";

interface UseNetworkStatusReturn {
  isOnline: boolean;
  isConnected: boolean;
}

/**
 * Custom hook for monitoring network status
 * Uses fetch to check connectivity and updates offline queue
 */
export function useNetworkStatus(): UseNetworkStatusReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasOnlineRef = useRef(true);
  const appStateCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasCheckedRef = useRef(false); // Track if we've done at least one check

  const checkConnectivity = async (): Promise<boolean> => {
    try {
      const serverUri = getServerUri();

      // Try to reach the base server URL instead of a specific endpoint
      // This is more reliable as it doesn't depend on a specific endpoint existing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Try HEAD request to base URL first (lightweight)
      try {
        const response = await fetch(serverUri, {
          method: "HEAD",
          signal: controller.signal,
          cache: "no-cache",
        });
        clearTimeout(timeoutId);
        return response.status < 500; // Accept any response except server errors
      } catch (headError) {
        // If HEAD fails, try a GET request to a common endpoint
        clearTimeout(timeoutId);
        const getController = new AbortController();
        const getTimeoutId = setTimeout(() => getController.abort(), 2000);

        try {
          // Try a lightweight endpoint that likely exists (like /driver/me or just base URL)
          const getResponse = await fetch(`${serverUri}/driver/me`, {
            method: "HEAD",
            signal: getController.signal,
            cache: "no-cache",
          });
          clearTimeout(getTimeoutId);
          // Accept 401/403 as "online" (server is reachable, just auth required)
          return getResponse.status < 500;
        } catch (getError) {
          clearTimeout(getTimeoutId);
          // If both fail, assume offline
          return false;
        }
      }
    } catch (error) {
      // Network error or timeout - assume offline
      return false;
    }
  };

  useEffect(() => {
    // Initial check with a small delay to avoid false negatives on app startup
    initialCheckTimeoutRef.current = setTimeout(() => {
      checkConnectivity().then((online) => {
        hasCheckedRef.current = true;
        setIsOnline(online);
        setIsConnected(online);
        wasOnlineRef.current = online;
        offlineQueue.setOnlineStatus(online);
      });
    }, 1000); // Wait 1 second before first check

    // Check connectivity periodically
    checkIntervalRef.current = setInterval(async () => {
      const online = await checkConnectivity();
      const wasOnline = wasOnlineRef.current;

      if (wasOnline !== online) {
        setIsOnline(online);
        setIsConnected(online);
        wasOnlineRef.current = online;
        offlineQueue.setOnlineStatus(online);

        if (online) {
          logger.info("Network connection restored");
        } else {
          logger.warn("Network connection lost");
        }
      }
    }, 15000); // Check every 15 seconds (reduced frequency)

    // Also check when app comes to foreground (debounced)
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          // Clear any pending check
          if (appStateCheckTimeoutRef.current) {
            clearTimeout(appStateCheckTimeoutRef.current);
          }

          // Debounce the check to prevent rapid checks
          appStateCheckTimeoutRef.current = setTimeout(() => {
            checkConnectivity().then((online) => {
              const wasOnline = wasOnlineRef.current;
              setIsOnline(online);
              setIsConnected(online);
              wasOnlineRef.current = online;
              offlineQueue.setOnlineStatus(online);

              if (wasOnline !== online && online) {
                logger.info("Network connection restored (app foregrounded)");
              }
            });
          }, 2000); // Wait 2 seconds after app becomes active before checking
        }
      }
    );

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (appStateCheckTimeoutRef.current) {
        clearTimeout(appStateCheckTimeoutRef.current);
      }
      if (initialCheckTimeoutRef.current) {
        clearTimeout(initialCheckTimeoutRef.current);
      }
      subscription.remove();
    };
  }, []);

  return {
    isOnline,
    isConnected,
  };
}
