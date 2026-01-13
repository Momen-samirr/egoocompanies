/**
 * WebSocket service for trip location updates
 * Handles connection lifecycle, subscriptions, and message handling
 */

import { Platform } from "react-native";
import { getParentData } from "@/lib/auth";
import {
  ConnectionState,
  TripLocationUpdate,
  TripSubscriptionConfirmed,
  SubscribeToTripMessage,
  UnsubscribeFromTripMessage,
  WebSocketMessage,
  WebSocketCallbacks,
} from "../types";
import {
  WEBSOCKET_RECONNECT_MAX_ATTEMPTS,
  WEBSOCKET_RECONNECT_BASE_DELAY,
  WEBSOCKET_RECONNECT_MAX_DELAY,
} from "../constants";

/**
 * Get WebSocket URL based on environment and platform
 */
function getWebSocketUrl(): string {
  if (process.env.EXPO_PUBLIC_WEBSOCKET_URL) {
    let url = process.env.EXPO_PUBLIC_WEBSOCKET_URL.trim();
    url = url.replace(/^\/+/, "");

    const hasWss = url.match(/^wss:\/\//i);
    const hasWs = url.match(/^ws:\/\//i);

    if (hasWss || hasWs) {
      return url;
    }

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";
    if (apiUrl.startsWith("https://")) {
      return `wss://${url}`;
    } else {
      return `ws://${url}`;
    }
  }

  // Extract host from API URL to ensure consistency
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    (Platform.OS === "android"
      ? "http://192.168.1.105:8000/api/v1"
      : "http://localhost:8000/api/v1");

  try {
    const apiUrlObj = new URL(apiUrl);
    const host = apiUrlObj.hostname;

    if (host === "localhost" || host === "127.0.0.1") {
      return "ws://localhost:8080";
    } else if (host === "10.0.2.2") {
      return "ws://10.0.2.2:8080";
    } else {
      return `ws://${host}:8080`;
    }
  } catch (e) {
    if (Platform.OS === "android") {
      return "ws://192.168.1.105:8080";
    }
    return "ws://localhost:8080";
  }
}

/**
 * WebSocket service class
 * Manages WebSocket connection, subscriptions, and message handling
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts: number = 0;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private isCleaningUp: boolean = false;
  private isConnecting: boolean = false;
  private callbacks: WebSocketCallbacks = {};
  private parentId: string | null = null;
  private currentTripId: string | null = null;
  private currentStudentId: string | null = null;
  
  // Static cache for parent data to avoid AsyncStorage reads on every connection
  private static parentDataCache: any | null = null;

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return (
      this.connectionState === ConnectionState.CONNECTED &&
      this.ws !== null &&
      this.ws.readyState === WebSocket.OPEN
    );
  }

  /**
   * Set callbacks for WebSocket events
   */
  setCallbacks(callbacks: WebSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnecting) {
      console.log("[WebSocket Service] Connection already in progress");
      return;
    }

    if (this.isCleaningUp) {
      console.log("[WebSocket Service] Cleanup in progress, skipping connection");
      return;
    }

    // Close existing connection if any
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("[WebSocket Service] Closing existing connection");
      try {
        this.ws.close(1000, "Creating new connection");
      } catch (e) {
        console.error("[WebSocket Service] Error closing existing connection:", e);
      }
    }

    this.isConnecting = true;
    this.connectionState = ConnectionState.CONNECTING;

    try {
      // Use cached parent data if available, otherwise fetch and cache
      let parent = WebSocketService.parentDataCache;
      if (!parent) {
        parent = await getParentData();
        if (parent && parent.id) {
          WebSocketService.parentDataCache = parent;
        }
      }
      
      if (!parent || !parent.id) {
        throw new Error("Parent data not found");
      }

      this.parentId = parent.id;

      const baseUrl = getWebSocketUrl().replace(/\/+$/, "");
      const wsUrl = `${baseUrl}?role=parent&parentId=${parent.id}`;

      console.log("[WebSocket Service] Connecting to:", wsUrl.replace(/wss?:\/\//, "***://"));

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WebSocket Service] Connected successfully");
        this.isConnecting = false;
        this.connectionState = ConnectionState.CONNECTED;
        this.reconnectAttempts = 0;

        if (this.callbacks.onOpen) {
          this.callbacks.onOpen();
        }

        // Subscribe to current trip if available
        if (this.currentTripId && this.currentStudentId) {
          this.subscribe(this.currentTripId, this.currentStudentId);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          if (data.type === "tripLocationUpdate") {
            const update = data as TripLocationUpdate;
            console.log("[WebSocket Service] Received location update:", {
              tripId: update.tripId,
              studentId: update.studentId,
              location: update.location,
              timestamp: update.timestamp,
              hasEta: !!update.eta,
            });
            // Verify tripId and studentId match before accepting update
            if (
              update.tripId === this.currentTripId &&
              update.studentId === this.currentStudentId
            ) {
              console.log("[WebSocket Service] Location update matches subscription, calling onMessage callback");
              if (this.callbacks.onMessage) {
                this.callbacks.onMessage(update);
              }
            } else {
              console.warn(
                "[WebSocket Service] Location update ignored - ID mismatch",
                {
                  updateTripId: update.tripId,
                  updateStudentId: update.studentId,
                  subscribedTripId: this.currentTripId,
                  subscribedStudentId: this.currentStudentId,
                }
              );
            }
          } else if (data.type === "tripSubscriptionConfirmed") {
            const confirmation = data as TripSubscriptionConfirmed;
            console.log("[WebSocket Service] Subscription confirmed:", confirmation);
            if (this.callbacks.onSubscriptionConfirmed) {
              this.callbacks.onSubscriptionConfirmed(confirmation);
            }
          } else {
            console.log("[WebSocket Service] Unknown message type:", data.type);
          }
        } catch (err) {
          console.error("[WebSocket Service] Error parsing message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[WebSocket Service] Connection error:", err);
        this.isConnecting = false;
        this.connectionState = ConnectionState.ERROR;

        if (this.callbacks.onError) {
          this.callbacks.onError(
            err instanceof Error ? err : new Error("WebSocket connection error")
          );
        }
      };

      ws.onclose = (event) => {
        console.log("[WebSocket Service] Disconnected", {
          code: event.code,
          reason: event.reason || "No reason provided",
          wasClean: event.wasClean,
        });

        this.isConnecting = false;
        this.connectionState = ConnectionState.DISCONNECTED;

        if (this.callbacks.onClose) {
          this.callbacks.onClose();
        }

        // Attempt to reconnect if not cleaning up
        if (!this.isCleaningUp) {
          this.attemptReconnect();
        }
      };

      this.ws = ws;
    } catch (err: any) {
      this.isConnecting = false;
      this.connectionState = ConnectionState.ERROR;
      console.error("[WebSocket Service] Connection error:", err);
      throw err;
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= WEBSOCKET_RECONNECT_MAX_ATTEMPTS) {
      console.error("[WebSocket Service] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(
      WEBSOCKET_RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      WEBSOCKET_RECONNECT_MAX_DELAY
    );

    console.log(
      `[WebSocket Service] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${WEBSOCKET_RECONNECT_MAX_ATTEMPTS})`
    );

    this.reconnectTimeoutId = setTimeout(() => {
      if (!this.isCleaningUp) {
        this.connect().catch((err) => {
          console.error("[WebSocket Service] Reconnection failed:", err);
        });
      }
    }, delay);
  }

  /**
   * Subscribe to trip location updates
   */
  subscribe(tripId: string, studentId: string): void {
    this.currentTripId = tripId;
    this.currentStudentId = studentId;

    if (!this.isConnected() || !this.parentId) {
      console.warn("[WebSocket Service] Cannot subscribe - not connected");
      return;
    }

    const message: SubscribeToTripMessage = {
      type: "subscribeToTrip",
      role: "parent",
      tripId,
      studentId,
      parentId: this.parentId,
    };

    try {
      this.ws!.send(JSON.stringify(message));
      console.log("[WebSocket Service] Subscription sent:", message);
    } catch (error) {
      console.error("[WebSocket Service] Error sending subscription:", error);
    }
  }

  /**
   * Unsubscribe from trip location updates
   */
  unsubscribe(tripId: string): void {
    if (!this.isConnected()) {
      console.warn("[WebSocket Service] Cannot unsubscribe - not connected");
      return;
    }

    const message: UnsubscribeFromTripMessage = {
      type: "unsubscribeFromTrip",
      role: "parent",
      tripId,
    };

    try {
      this.ws!.send(JSON.stringify(message));
      console.log("[WebSocket Service] Unsubscribed from trip:", tripId);
    } catch (error) {
      console.error("[WebSocket Service] Error unsubscribing:", error);
    }

    // Clear current trip IDs
    if (this.currentTripId === tripId) {
      this.currentTripId = null;
      this.currentStudentId = null;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isCleaningUp = true;

    // Clear reconnect timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    // Unsubscribe before closing
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentTripId) {
      try {
        this.ws.send(
          JSON.stringify({
            type: "unsubscribeFromTrip",
            role: "parent",
            tripId: this.currentTripId,
          })
        );
        console.log("[WebSocket Service] Unsubscribed before disconnect");
      } catch (e) {
        console.error("[WebSocket Service] Error unsubscribing:", e);
      }
    }

    // Close connection
    if (this.ws) {
      try {
        // Remove handlers to prevent reconnection triggers
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;

        this.ws.close(1000, "Component unmounting");
        console.log("[WebSocket Service] Connection closed");
      } catch (e) {
        console.error("[WebSocket Service] Error closing connection:", e);
      }
      this.ws = null;
    }

    this.connectionState = ConnectionState.DISCONNECTED;
    this.currentTripId = null;
    this.currentStudentId = null;
    this.parentId = null;

    // Reset cleanup flag after a delay
    setTimeout(() => {
      this.isCleaningUp = false;
    }, 1000);
  }
}

