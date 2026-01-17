/**
 * Constants for track-trip feature
 */

import Constants from "expo-constants";

/**
 * Google Maps API Key
 */
export const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.googleMaps?.apiKey ||
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
  "AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q";

/**
 * Trip data polling interval (milliseconds)
 */
export const TRIP_POLLING_INTERVAL = 5000; // 5 seconds

/**
 * ETA calculation debounce delay (milliseconds)
 */
export const ETA_DEBOUNCE_DELAY = 3000; // 3 seconds

/**
 * Minimum distance change for ETA recalculation (meters)
 */
export const ETA_MIN_DISTANCE_CHANGE = 50; // 50 meters

/**
 * Coordinate change threshold for marker updates (degrees)
 * 0.000001 degrees ≈ 0.11 meters (very sensitive for real-time tracking)
 * Lower threshold ensures all real movements are detected
 */
export const COORDINATE_CHANGE_THRESHOLD = 0.000001;

/**
 * Map region padding percentage
 */
export const MAP_REGION_PADDING = 0.2; // 20% padding

/**
 * Default map region delta (zoom level)
 */
export const DEFAULT_MAP_DELTA = 0.01;

/**
 * Fallback speed for Haversine ETA calculation (km/h)
 */
export const FALLBACK_SPEED_KMH = 40;

/**
 * WebSocket reconnection settings
 */
export const WEBSOCKET_RECONNECT_MAX_ATTEMPTS = 5;
export const WEBSOCKET_RECONNECT_BASE_DELAY = 1000; // 1 second
export const WEBSOCKET_RECONNECT_MAX_DELAY = 30000; // 30 seconds

