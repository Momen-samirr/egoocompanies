/**
 * Navigation utility functions for calculating bearings and angles
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calculate the bearing (direction) from one coordinate to another
 * @param from Starting coordinate
 * @param to Destination coordinate
 * @returns Bearing in degrees (0-360, where 0 is North)
 */
export function calculateBearing(from: Coordinate, to: Coordinate): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180;

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  const bearing = Math.atan2(y, x);
  const bearingDegrees = (bearing * 180) / Math.PI;
  
  // Normalize to 0-360
  return normalizeAngle(bearingDegrees);
}

/**
 * Normalize an angle to be between 0 and 360 degrees
 * @param angle Angle in degrees
 * @returns Normalized angle (0-360)
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

/**
 * Calculate the relative bearing (direction to destination relative to vehicle heading)
 * @param heading Vehicle heading in degrees (0-360, where 0 is North)
 * @param bearingToDestination Bearing to destination in degrees (0-360)
 * @returns Relative bearing in degrees (-180 to 180, where 0 is straight ahead)
 */
export function calculateRelativeBearing(
  heading: number,
  bearingToDestination: number
): number {
  let relative = bearingToDestination - heading;
  
  // Normalize to -180 to 180 range
  if (relative > 180) {
    relative -= 360;
  } else if (relative < -180) {
    relative += 360;
  }
  
  return relative;
}

/**
 * Calculate heading from movement direction (fallback when compass is unavailable)
 * @param from Previous location
 * @param to Current location
 * @returns Heading in degrees (0-360, where 0 is North)
 */
export function calculateHeadingFromMovement(
  from: Coordinate,
  to: Coordinate
): number | null {
  // Only calculate if there's meaningful movement (at least 5 meters)
  const distance = Math.sqrt(
    Math.pow(to.latitude - from.latitude, 2) +
    Math.pow(to.longitude - from.longitude, 2)
  );
  
  // If movement is too small, return null
  if (distance < 0.00005) { // approximately 5 meters
    return null;
  }
  
  return calculateBearing(from, to);
}

/**
 * Smooth angle transition to prevent jittery rotation
 * @param currentAngle Current angle in degrees
 * @param targetAngle Target angle in degrees
 * @param smoothingFactor Smoothing factor (0-1, where 1 is no smoothing)
 * @returns Smoothed angle in degrees
 */
export function smoothAngleTransition(
  currentAngle: number,
  targetAngle: number,
  smoothingFactor: number = 0.1
): number {
  // Handle the wrap-around case (e.g., 350° to 10°)
  let diff = targetAngle - currentAngle;
  
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }
  
  return normalizeAngle(currentAngle + diff * smoothingFactor);
}

