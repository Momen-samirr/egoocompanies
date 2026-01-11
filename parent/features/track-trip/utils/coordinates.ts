/**
 * Coordinate calculation utilities
 */

import { Coordinate } from "../types";

/**
 * Calculate distance between two coordinates using Haversine formula (in meters)
 */
export function calculateDistanceHaversine(
  origin: Coordinate,
  destination: Coordinate
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const dLon = ((destination.longitude - origin.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.latitude * Math.PI) / 180) *
      Math.cos((destination.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if two coordinates have changed significantly
 * @param prev Previous coordinate
 * @param current Current coordinate
 * @param threshold Minimum distance change in degrees (default: 0.00001 ≈ 1.1m)
 * @returns true if coordinates changed significantly
 */
export function hasCoordinateChanged(
  prev: Coordinate | null,
  current: Coordinate,
  threshold: number = 0.00001
): boolean {
  if (!prev) return true;
  return (
    Math.abs(prev.latitude - current.latitude) > threshold ||
    Math.abs(prev.longitude - current.longitude) > threshold
  );
}

/**
 * Check if coordinate has moved by a certain distance in meters
 * @param prev Previous coordinate
 * @param current Current coordinate
 * @param distanceMeters Minimum distance change in meters (default: 50m)
 * @returns true if moved by at least the specified distance
 */
export function hasMovedByDistance(
  prev: Coordinate | null,
  current: Coordinate,
  distanceMeters: number = 50
): boolean {
  if (!prev) return true;
  const distance = calculateDistanceHaversine(prev, current);
  return distance >= distanceMeters;
}

