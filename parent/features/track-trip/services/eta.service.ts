/**
 * ETA calculation service
 * Handles Google Maps Directions API calls and Haversine fallback
 */

import { Coordinate, ETA } from "../types";
import {
  isValidCoordinate,
  areValidCoordinatesForAPI,
} from "../utils/validation";
import { calculateDistanceHaversine } from "../utils/coordinates";
import {
  GOOGLE_MAPS_API_KEY,
  FALLBACK_SPEED_KMH,
} from "../constants";

/**
 * Google Maps Directions API response types
 */
interface DirectionsResponse {
  status: string;
  routes?: Array<{
    legs: Array<{
      distance: { value: number; text: string };
      duration: { value: number; text: string };
      duration_in_traffic?: { value: number; text: string };
    }>;
  }>;
  error_message?: string;
}

/**
 * Get accurate distance and duration from Google Maps Directions API
 */
async function getDirectionsData(
  origin: Coordinate,
  destination: Coordinate,
  apiKey: string
): Promise<{ distanceMeters: number; durationMinutes: number } | null> {
  if (!areValidCoordinatesForAPI(origin, destination)) {
    console.warn("[ETA Service] Invalid coordinates for Directions API");
    return null;
  }

  try {
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destinationStr = `${destination.latitude},${destination.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&key=${apiKey}&departure_time=now&traffic_model=best_guess`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(
        "[ETA Service] Directions API HTTP error:",
        response.status,
        response.statusText
      );
      return null;
    }

    const data: DirectionsResponse = await response.json();

    if (data.status === "OK" && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];

      const distanceMeters = leg.distance?.value || 0;
      // Prefer duration_in_traffic if available, otherwise use duration
      const durationSeconds =
        leg.duration_in_traffic?.value || leg.duration?.value || 0;
      const durationMinutes = Math.round(durationSeconds / 60);

      return {
        distanceMeters,
        durationMinutes: Math.max(0, durationMinutes),
      };
    } else {
      console.warn("[ETA Service] Directions API error:", data.status, data.error_message);
      return null;
    }
  } catch (error: any) {
    console.error("[ETA Service] Directions API request failed:", error);
    return null;
  }
}

/**
 * Calculate ETA to destination using Google Maps Directions API with Haversine fallback
 */
export async function calculateETA(
  origin: Coordinate | null,
  destination: Coordinate | null,
  apiKey: string = GOOGLE_MAPS_API_KEY
): Promise<ETA | null> {
  if (!origin || !destination) {
    return null;
  }

  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    return null;
  }

  // Try Google Maps Directions API first for accurate results
  const directionsData = await getDirectionsData(origin, destination, apiKey);

  if (directionsData) {
    return {
      minutes: directionsData.durationMinutes,
      distanceMeters: directionsData.distanceMeters,
    };
  }

  // Fallback to Haversine calculation if API fails
  const distanceMeters = calculateDistanceHaversine(origin, destination);

  // Use fallback speed for ETA calculation
  const speedKmh = FALLBACK_SPEED_KMH;
  const speedKmPerMin = speedKmh / 60;
  const distanceKm = distanceMeters / 1000;
  const minutes = distanceKm / speedKmPerMin;

  return {
    minutes: Math.max(0, Math.round(minutes)),
    distanceMeters: Math.round(distanceMeters),
  };
}

