/**
 * WebSocket-related types for track-trip feature
 */

import { DriverLocation, ETA } from "./location.types";

/**
 * WebSocket connection states
 */
export enum ConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ERROR = "error",
}

/**
 * Trip location update message from WebSocket server
 */
export interface TripLocationUpdate {
  type: "tripLocationUpdate";
  tripId: string;
  studentId: string;
  driverId: string;
  location: DriverLocation;
  speed: number;
  deviationStatus: {
    isDeviated: boolean;
    distance: number;
  };
  eta?: ETA & {
    method?: string;
  };
  timestamp: string;
}

/**
 * Subscription confirmation message
 */
export interface TripSubscriptionConfirmed {
  type: "tripSubscriptionConfirmed";
  tripId: string;
  studentId: string;
  message: string;
}

/**
 * Subscription message to send to server
 */
export interface SubscribeToTripMessage {
  type: "subscribeToTrip";
  role: "parent";
  tripId: string;
  studentId: string;
  parentId: string;
}

/**
 * Unsubscribe message to send to server
 */
export interface UnsubscribeFromTripMessage {
  type: "unsubscribeFromTrip";
  role: "parent";
  tripId: string;
}

/**
 * WebSocket message types (union)
 */
export type WebSocketMessage = TripLocationUpdate | TripSubscriptionConfirmed;

/**
 * WebSocket event callbacks
 */
export interface WebSocketCallbacks {
  onMessage?: (data: TripLocationUpdate) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onOpen?: () => void;
  onSubscriptionConfirmed?: (data: TripSubscriptionConfirmed) => void;
}

