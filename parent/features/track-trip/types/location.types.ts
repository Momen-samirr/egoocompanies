/**
 * Location-related types for track-trip feature
 */

/**
 * Basic coordinate type
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Coordinate with optional heading (bearing)
 */
export interface CoordinateWithHeading extends Coordinate {
  heading?: number;
}

/**
 * Driver location received from WebSocket
 */
export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

/**
 * ETA calculation result
 */
export interface ETA {
  minutes: number;
  distanceMeters: number;
}

/**
 * ETA with method indicator
 */
export interface ETAWithMethod extends ETA {
  method?: "directions_api" | "haversine";
}

/**
 * Location update with metadata
 */
export interface LocationUpdate {
  location: DriverLocation;
  timestamp: string;
  speed?: number;
}

