import { Coordinate } from "@/services/navigationService";
import { decodePolyline } from "@/services/navigationService";

/**
 * Calculate the perpendicular distance from a point to a line segment
 * Returns distance in meters
 */
function pointToLineDistance(
  point: Coordinate,
  lineStart: Coordinate,
  lineEnd: Coordinate
): number {
  const A = point.latitude - lineStart.latitude;
  const B = point.longitude - lineStart.longitude;
  const C = lineEnd.latitude - lineStart.latitude;
  const D = lineEnd.longitude - lineStart.longitude;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number, yy: number;

  if (param < 0) {
    xx = lineStart.latitude;
    yy = lineStart.longitude;
  } else if (param > 1) {
    xx = lineEnd.latitude;
    yy = lineEnd.longitude;
  } else {
    xx = lineStart.latitude + param * C;
    yy = lineStart.longitude + param * D;
  }

  const dx = point.latitude - xx;
  const dy = point.longitude - yy;
  
  // Convert to meters using Haversine formula
  return haversineDistance(point, { latitude: xx, longitude: yy });
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function haversineDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.latitude)) *
      Math.cos(toRad(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate the minimum distance from a point to a polyline
 * Returns distance in meters
 */
export function distanceToPolyline(
  point: Coordinate,
  polyline: Coordinate[]
): number {
  if (polyline.length < 2) {
    return haversineDistance(point, polyline[0] || point);
  }

  let minDistance = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const distance = pointToLineDistance(
      point,
      polyline[i],
      polyline[i + 1]
    );
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

/**
 * Check if driver has deviated from the route
 * @param driverLocation Current driver location
 * @param routePolyline Encoded polyline string from Google Maps
 * @param deviationThreshold Distance in meters to consider as deviation (default: 50m)
 * @returns Object with isDeviated flag and distance from route
 */
export function checkRouteDeviation(
  driverLocation: Coordinate,
  routePolyline: string,
  deviationThreshold: number = 50
): { isDeviated: boolean; distanceFromRoute: number } {
  try {
    // Decode polyline
    const decodedPolyline = decodePolyline(routePolyline);
    
    if (decodedPolyline.length < 2) {
      return { isDeviated: false, distanceFromRoute: 0 };
    }

    // Calculate minimum distance from driver to route
    const distanceFromRoute = distanceToPolyline(driverLocation, decodedPolyline);

    const isDeviated = distanceFromRoute > deviationThreshold;

    if (isDeviated) {
      console.log(`⚠️ Driver deviated from route: ${distanceFromRoute.toFixed(2)}m (threshold: ${deviationThreshold}m)`);
    }

    return {
      isDeviated,
      distanceFromRoute,
    };
  } catch (error) {
    console.error("❌ Error checking route deviation:", error);
    return { isDeviated: false, distanceFromRoute: 0 };
  }
}

/**
 * Check if driver is approaching a waypoint or destination
 * @param driverLocation Current driver location
 * @param targetLocation Target location (waypoint or destination)
 * @param arrivalThreshold Distance in meters to consider as arrived (default: 50m)
 * @returns Object with isArrived flag and distance to target
 */
export function checkArrival(
  driverLocation: Coordinate,
  targetLocation: Coordinate,
  arrivalThreshold: number = 50
): { isArrived: boolean; distanceToTarget: number } {
  const distanceToTarget = haversineDistance(driverLocation, targetLocation);
  const isArrived = distanceToTarget <= arrivalThreshold;

  if (isArrived) {
    console.log(`✅ Arrived at target: ${distanceToTarget.toFixed(2)}m`);
  }

  return {
    isArrived,
    distanceToTarget,
  };
}

