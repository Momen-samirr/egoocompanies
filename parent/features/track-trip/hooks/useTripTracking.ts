/**
 * Main hook for trip tracking
 * Orchestrates WebSocket connection for location updates
 */

import { useEffect, useState, useRef } from "react";
import {
  TripLocationUpdate,
  WebSocketCallbacks,
} from "../types";
import { WebSocketService } from "../services/websocket.service";

/**
 * Options for useTripTracking hook
 */
export interface UseTripTrackingOptions {
  tripId: string | string[] | undefined;
  studentId: string | string[] | undefined;
  enabled?: boolean;
}

/**
 * Return type for useTripTracking hook
 */
export interface UseTripTrackingReturn {
  location: TripLocationUpdate | null;
  connected: boolean;
  error: string | null;
}

// Singleton WebSocket service instance
let wsServiceInstance: WebSocketService | null = null;

function getWebSocketService(): WebSocketService {
  if (!wsServiceInstance) {
    wsServiceInstance = new WebSocketService();
  }
  return wsServiceInstance;
}

/**
 * Main hook for tracking trip location via WebSocket
 * Handles WebSocket connection and location updates only
 * Trip data should be managed separately using useTripData
 */
export function useTripTracking({
  tripId,
  studentId,
  enabled = true,
}: UseTripTrackingOptions): UseTripTrackingReturn {
  const [location, setLocation] = useState<TripLocationUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsServiceRef = useRef<WebSocketService | null>(null);
  const isSubscribedRef = useRef(false);

  // Normalize IDs
  const normalizedTripId = Array.isArray(tripId) ? tripId[0] : tripId;
  const normalizedStudentId = Array.isArray(studentId)
    ? studentId[0]
    : studentId;

  // Initialize WebSocket service
  useEffect(() => {
    if (!enabled || !normalizedTripId || !normalizedStudentId) {
      return;
    }

    const wsService = getWebSocketService();
    wsServiceRef.current = wsService;

    // Set up callbacks
    const callbacks: WebSocketCallbacks = {
      onOpen: () => {
        setConnected(true);
        setError(null);
        console.log("[useTripTracking] WebSocket connected");

        // Subscribe to trip updates
        if (normalizedTripId && normalizedStudentId && !isSubscribedRef.current) {
          wsService.subscribe(normalizedTripId, normalizedStudentId);
          isSubscribedRef.current = true;
        }
      },
      onMessage: (data: TripLocationUpdate) => {
        console.log("[useTripTracking] Received location update in hook:", {
          tripId: data.tripId,
          studentId: data.studentId,
          location: data.location,
          timestamp: data.timestamp,
        });
        // Verify tripId and studentId match before accepting update
        if (
          data.tripId === normalizedTripId &&
          data.studentId === normalizedStudentId
        ) {
          console.log("[useTripTracking] Location update matches, updating state");
          setLocation(data);
        } else {
          console.warn("[useTripTracking] Location update ID mismatch, ignoring");
        }
      },
      onError: (err: Error) => {
        console.error("[useTripTracking] WebSocket error:", err);
        setError(err.message);
        setConnected(false);
      },
      onClose: () => {
        setConnected(false);
        isSubscribedRef.current = false;
        console.log("[useTripTracking] WebSocket disconnected");
      },
      onSubscriptionConfirmed: (data) => {
        console.log(
          "[useTripTracking] Subscription confirmed:",
          data.tripId === normalizedTripId && data.studentId === normalizedStudentId
        );
      },
    };

    wsService.setCallbacks(callbacks);

    // Connect to WebSocket
    wsService
      .connect()
      .then(() => {
        // Connection successful
      })
      .catch((err) => {
        console.error("[useTripTracking] Connection error:", err);
        setError("Failed to connect to WebSocket server");
      });

    return () => {
      // Cleanup: unsubscribe and disconnect
      if (wsService && normalizedTripId) {
        wsService.unsubscribe(normalizedTripId);
      }
      // Note: We don't disconnect the service completely as it might be used by other components
      // The service will handle cleanup internally when no longer needed
      isSubscribedRef.current = false;
    };
  }, [enabled, normalizedTripId, normalizedStudentId]);

  // Update subscription when tripId or studentId changes
  useEffect(() => {
    if (!enabled || !normalizedTripId || !normalizedStudentId) {
      return;
    }

    const wsService = wsServiceRef.current;
    if (wsService && wsService.isConnected()) {
      // Unsubscribe from previous trip if any
      if (isSubscribedRef.current && normalizedTripId) {
        wsService.unsubscribe(normalizedTripId);
      }

      // Subscribe to new trip
      wsService.subscribe(normalizedTripId, normalizedStudentId);
      isSubscribedRef.current = true;
    }
  }, [enabled, normalizedTripId, normalizedStudentId]);

  return {
    location,
    connected,
    error,
  };
}

