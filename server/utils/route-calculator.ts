import { getDistance } from "geolib";

interface Location {
  latitude: number;
  longitude: number;
}

interface Checkpoint {
  latitude: number;
  longitude: number;
  order: number;
}

interface RouteSegment {
  start: Location;
  end: Location;
}

/**
 * Calculate the distance from a location to the nearest point on a planned route
 * @param location Current location
 * @param plannedRoute Array of route points (checkpoints)
 * @returns Distance in meters
 */
export function calculateDistanceFromRoute(
  location: Location,
  plannedRoute: Location[]
): number {
  if (plannedRoute.length < 2) {
    // If route has less than 2 points, calculate distance to the single point
    if (plannedRoute.length === 1) {
      return getDistance(location, plannedRoute[0]);
    }
    return 0;
  }

  let minDistance = Infinity;

  // Check distance to each segment of the route
  for (let i = 0; i < plannedRoute.length - 1; i++) {
    const segmentStart = plannedRoute[i];
    const segmentEnd = plannedRoute[i + 1];

    // Calculate distance to the line segment
    const distance = distanceToLineSegment(location, segmentStart, segmentEnd);

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  // Also check distance to start and end points
  const distToStart = getDistance(location, plannedRoute[0]);
  const distToEnd = getDistance(
    location,
    plannedRoute[plannedRoute.length - 1]
  );

  return Math.min(minDistance, distToStart, distToEnd);
}

/**
 * Calculate distance from a point to a line segment
 * @param point Point to measure from
 * @param lineStart Start of line segment
 * @param lineEnd End of line segment
 * @returns Distance in meters
 */
function distanceToLineSegment(
  point: Location,
  lineStart: Location,
  lineEnd: Location
): number {
  // Convert to meters for calculation
  const A = point.longitude - lineStart.longitude;
  const B = point.latitude - lineStart.latitude;
  const C = lineEnd.longitude - lineStart.longitude;
  const D = lineEnd.latitude - lineStart.latitude;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number, yy: number;

  if (param < 0) {
    xx = lineStart.longitude;
    yy = lineStart.latitude;
  } else if (param > 1) {
    xx = lineEnd.longitude;
    yy = lineEnd.latitude;
  } else {
    xx = lineStart.longitude + param * C;
    yy = lineStart.latitude + param * D;
  }

  const dx = point.longitude - xx;
  const dy = point.latitude - yy;

  // Convert to meters using Haversine formula
  return getDistance(
    { latitude: point.latitude, longitude: point.longitude },
    { latitude: yy, longitude: xx }
  );
}

/**
 * Calculate distance from location to a specific checkpoint
 * @param location Current location
 * @param checkpoint Target checkpoint
 * @returns Distance in meters
 */
export function calculateDistanceToCheckpoint(
  location: Location,
  checkpoint: Checkpoint
): number {
  // Validate inputs
  if (
    !location ||
    !checkpoint ||
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number" ||
    typeof checkpoint.latitude !== "number" ||
    typeof checkpoint.longitude !== "number" ||
    isNaN(location.latitude) ||
    isNaN(location.longitude) ||
    isNaN(checkpoint.latitude) ||
    isNaN(checkpoint.longitude)
  ) {
    console.error("[Route Calculator] Invalid input for distance calculation", {
      location,
      checkpoint,
    });
    return 0;
  }

  const distance = getDistance(location, {
    latitude: checkpoint.latitude,
    longitude: checkpoint.longitude,
  });

  // Log for verification in development (can be disabled in production)
  if (process.env.NODE_ENV === "development") {
    console.debug("[Route Calculator] Distance to checkpoint calculated", {
      from: { lat: location.latitude, lng: location.longitude },
      to: { lat: checkpoint.latitude, lng: checkpoint.longitude },
      distanceMeters: distance,
      distanceKm: (distance / 1000).toFixed(2),
    });
  }

  return distance;
}

/**
 * Detect if driver has deviated from the planned route
 * @param location Current location
 * @param plannedRoute Array of route points
 * @param threshold Distance threshold in meters (default: 100m)
 * @returns Object with isDeviated boolean and distance in meters
 */
export function detectRouteDeviation(
  location: Location,
  plannedRoute: Location[],
  threshold: number = 100
): { isDeviated: boolean; distance: number } {
  const distance = calculateDistanceFromRoute(location, plannedRoute);
  return {
    isDeviated: distance > threshold,
    distance,
  };
}

/**
 * Calculate route efficiency (actual distance / planned distance)
 * @param actualPath Array of actual locations traveled
 * @param plannedPath Array of planned route points
 * @returns Efficiency percentage (100% = perfect, >100% = longer route)
 */
export function calculateRouteEfficiency(
  actualPath: Location[],
  plannedPath: Location[]
): number {
  if (actualPath.length < 2 || plannedPath.length < 2) {
    return 100; // Can't calculate if insufficient data
  }

  // Calculate total actual distance
  let actualDistance = 0;
  for (let i = 0; i < actualPath.length - 1; i++) {
    actualDistance += getDistance(actualPath[i], actualPath[i + 1]);
  }

  // Calculate total planned distance
  let plannedDistance = 0;
  for (let i = 0; i < plannedPath.length - 1; i++) {
    plannedDistance += getDistance(plannedPath[i], plannedPath[i + 1]);
  }

  if (plannedDistance === 0) {
    return 100;
  }

  return (actualDistance / plannedDistance) * 100;
}

/**
 * Find the nearest point on the route to a given location
 * @param location Current location
 * @param route Array of route points
 * @returns Nearest point on route and its index
 */
export function findNearestPointOnRoute(
  location: Location,
  route: Location[]
): { point: Location; segmentIndex: number; distance: number } {
  if (route.length < 2) {
    if (route.length === 1) {
      return {
        point: route[0],
        segmentIndex: 0,
        distance: getDistance(location, route[0]),
      };
    }
    throw new Error("Route must have at least one point");
  }

  let minDistance = Infinity;
  let nearestPoint: Location = route[0];
  let segmentIndex = 0;

  // Check each segment
  for (let i = 0; i < route.length - 1; i++) {
    const segmentStart = route[i];
    const segmentEnd = route[i + 1];

    // Find closest point on this segment
    const closestPoint = closestPointOnSegment(
      location,
      segmentStart,
      segmentEnd
    );
    const distance = getDistance(location, closestPoint);

    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = closestPoint;
      segmentIndex = i;
    }
  }

  return {
    point: nearestPoint,
    segmentIndex,
    distance: minDistance,
  };
}

/**
 * Find the closest point on a line segment to a given point
 * @param point Point to find closest point for
 * @param lineStart Start of line segment
 * @param lineEnd End of line segment
 * @returns Closest point on the segment
 */
function closestPointOnSegment(
  point: Location,
  lineStart: Location,
  lineEnd: Location
): Location {
  const A = point.longitude - lineStart.longitude;
  const B = point.latitude - lineStart.latitude;
  const C = lineEnd.longitude - lineStart.longitude;
  const D = lineEnd.latitude - lineStart.latitude;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  if (param < 0) {
    return lineStart;
  } else if (param > 1) {
    return lineEnd;
  } else {
    return {
      latitude: lineStart.latitude + param * D,
      longitude: lineStart.longitude + param * C,
    };
  }
}

/**
 * Calculate total distance of a path
 * @param path Array of locations
 * @returns Total distance in meters
 */
export function calculatePathDistance(path: Location[]): number {
  if (path.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += getDistance(path[i], path[i + 1]);
  }

  return totalDistance;
}

/**
 * Check if a location is near a checkpoint (within threshold)
 * @param location Current location
 * @param checkpoint Target checkpoint
 * @param threshold Distance threshold in meters (default: 50m)
 * @returns True if within threshold
 */
export function isNearCheckpoint(
  location: Location,
  checkpoint: Checkpoint,
  threshold: number = 50
): boolean {
  const distance = calculateDistanceToCheckpoint(location, checkpoint);
  return distance <= threshold;
}
