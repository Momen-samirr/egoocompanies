import { useEffect, useState, useRef } from "react";
import { getParentData } from "@/lib/auth";

const WEBSOCKET_URL =
  process.env.EXPO_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080";

interface TripLocationUpdate {
  type: "tripLocationUpdate";
  tripId: string;
  studentId: string;
  driverId: string;
  location: {
    latitude: number;
    longitude: number;
    heading?: number;
  };
  speed: number;
  deviationStatus: {
    isDeviated: boolean;
    distance: number;
  };
  eta?: {
    minutes: number;
    distanceMeters: number;
    method: string;
  };
  timestamp: string;
}

interface UseTripTrackingOptions {
  tripId: string;
  studentId: string;
  enabled?: boolean;
}

export const useTripTracking = ({
  tripId,
  studentId,
  enabled = true,
}: UseTripTrackingOptions) => {
  const [location, setLocation] = useState<TripLocationUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!enabled || !tripId || !studentId) {
      return;
    }

    const connect = async () => {
      try {
        const parent = await getParentData();
        if (!parent) {
          setError("Parent data not found");
          return;
        }

        const wsUrl = `${WEBSOCKET_URL}?role=parent&parentId=${parent.id}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[WebSocket] Connected");
          setConnected(true);
          setError(null);
          reconnectAttempts.current = 0;

          // Subscribe to trip updates
          ws.send(
            JSON.stringify({
              type: "subscribeToTrip",
              role: "parent",
              tripId,
              studentId,
              parentId: parent.id,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "tripSubscriptionConfirmed") {
              console.log("[WebSocket] Subscribed to trip updates");
            } else if (data.type === "tripLocationUpdate") {
              setLocation(data as TripLocationUpdate);
            }
          } catch (err) {
            console.error("[WebSocket] Error parsing message:", err);
          }
        };

        ws.onerror = (err) => {
          console.error("[WebSocket] Error:", err);
          setError("WebSocket connection error");
          setConnected(false);
        };

        ws.onclose = () => {
          console.log("[WebSocket] Disconnected");
          setConnected(false);

          // Attempt to reconnect
          if (reconnectAttempts.current < 5) {
            reconnectAttempts.current += 1;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          } else {
            setError("Failed to reconnect. Please refresh.");
          }
        };

        wsRef.current = ws;
      } catch (err) {
        console.error("[WebSocket] Connection error:", err);
        setError("Failed to connect to WebSocket server");
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [tripId, studentId, enabled]);

  const unsubscribe = () => {
    if (wsRef.current && connected) {
      wsRef.current.send(
        JSON.stringify({
          type: "unsubscribeFromTrip",
          role: "parent",
          tripId,
        })
      );
    }
  };

  return {
    location,
    connected,
    error,
    unsubscribe,
  };
};







