import * as Location from "expo-location";

/**
 * Location update configuration based on movement speed
 */
export interface LocationConfig {
  accuracy: Location.Accuracy;
  timeInterval: number;
  distanceInterval: number;
}

/**
 * Speed thresholds for different update intervals (in m/s)
 * 1 m/s ≈ 3.6 km/h
 */
const SPEED_THRESHOLDS = {
  FAST: 5.56,      // ~20 km/h - update every 2 seconds
  MEDIUM: 1.39,    // ~5 km/h - update every 5 seconds
  SLOW: 0,         // Stationary - update every 10 seconds
};

/**
 * Get location update configuration based on speed
 * @param speed Speed in meters per second (m/s)
 * @returns Location configuration with optimized intervals
 */
export const getLocationConfig = (speed: number | null | undefined): LocationConfig => {
  // Default to balanced accuracy if speed is unknown
  if (speed === null || speed === undefined || isNaN(speed)) {
    return {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,      // 5 seconds default
      distanceInterval: 10,    // 10 meters
    };
  }

  // Fast movement (> 20 km/h)
  if (speed > SPEED_THRESHOLDS.FAST) {
    return {
      accuracy: Location.Accuracy.High,
      timeInterval: 2000,       // 2 seconds - more frequent updates
      distanceInterval: 20,     // 20 meters - larger distance threshold
    };
  }

  // Medium movement (5-20 km/h)
  if (speed > SPEED_THRESHOLDS.MEDIUM) {
    return {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,       // 5 seconds
      distanceInterval: 10,    // 10 meters
    };
  }

  // Slow movement or stationary (< 5 km/h)
  return {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 10000,        // 10 seconds - less frequent updates
    distanceInterval: 5,       // 5 meters - smaller distance threshold
  };
};

/**
 * Calculate speed from two location points
 * @param location1 First location with timestamp
 * @param location2 Second location with timestamp
 * @returns Speed in meters per second (m/s)
 */
export const calculateSpeed = (
  location1: { latitude: number; longitude: number; timestamp?: number },
  location2: { latitude: number; longitude: number; timestamp?: number }
): number | null => {
  if (!location1.timestamp || !location2.timestamp) {
    return null;
  }

  const timeDelta = (location2.timestamp - location1.timestamp) / 1000; // Convert to seconds
  if (timeDelta <= 0) {
    return null;
  }

  // Calculate distance using Haversine formula
  const R = 6371e3; // Earth's radius in meters
  const toRad = (x: number) => (x * Math.PI) / 180;

  const lat1 = toRad(location1.latitude);
  const lat2 = toRad(location2.latitude);
  const deltaLat = toRad(location2.latitude - location1.latitude);
  const deltaLon = toRad(location2.longitude - location1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in meters

  const speed = distance / timeDelta; // Speed in m/s
  return speed;
};

/**
 * Check if location update should be sent based on distance threshold
 * @param lastLocation Last sent location
 * @param currentLocation Current location
 * @param threshold Distance threshold in meters
 * @returns True if update should be sent
 */
export const shouldSendLocationUpdate = (
  lastLocation: { latitude: number; longitude: number } | null,
  currentLocation: { latitude: number; longitude: number },
  threshold: number = 200 // 200 meters default
): boolean => {
  if (!lastLocation) {
    return true; // Always send first location
  }

  // Calculate distance
  const R = 6371e3; // Earth's radius in meters
  const toRad = (x: number) => (x * Math.PI) / 180;

  const lat1 = toRad(lastLocation.latitude);
  const lat2 = toRad(currentLocation.latitude);
  const deltaLat = toRad(currentLocation.latitude - lastLocation.latitude);
  const deltaLon = toRad(currentLocation.longitude - lastLocation.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in meters

  return distance >= threshold;
};

