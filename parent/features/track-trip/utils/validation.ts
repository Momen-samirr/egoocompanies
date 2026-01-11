/**
 * Validation utilities for coordinates and trip data
 */

import { Coordinate } from "../types";

/**
 * Validate coordinate values
 * @param coord Coordinate to validate
 * @returns true if coordinate is valid
 */
export function isValidCoordinate(coord: Coordinate | null | undefined): boolean {
  if (!coord) return false;
  
  if (
    typeof coord.latitude !== "number" ||
    typeof coord.longitude !== "number" ||
    isNaN(coord.latitude) ||
    isNaN(coord.longitude)
  ) {
    return false;
  }

  if (
    Math.abs(coord.latitude) > 90 ||
    Math.abs(coord.longitude) > 180
  ) {
    return false;
  }

  return true;
}

/**
 * Validate trip ID and student ID
 * @param tripId Trip ID to validate
 * @param studentId Student ID to validate
 * @returns true if both IDs are valid
 */
export function isValidTripParams(
  tripId: string | string[] | undefined,
  studentId: string | string[] | undefined
): boolean {
  const normalizedTripId = Array.isArray(tripId) ? tripId[0] : tripId;
  const normalizedStudentId = Array.isArray(studentId)
    ? studentId[0]
    : studentId;

  return (
    typeof normalizedTripId === "string" &&
    normalizedTripId.length > 0 &&
    typeof normalizedStudentId === "string" &&
    normalizedStudentId.length > 0
  );
}

/**
 * Validate coordinates for Google Maps API call
 * @param origin Origin coordinate
 * @param destination Destination coordinate
 * @returns true if both coordinates are valid for API call
 */
export function areValidCoordinatesForAPI(
  origin: Coordinate | null | undefined,
  destination: Coordinate | null | undefined
): boolean {
  return isValidCoordinate(origin) && isValidCoordinate(destination);
}

