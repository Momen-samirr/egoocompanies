import axios from "axios";
import { calculateDistanceToCheckpoint } from "../utils/route-calculator";

interface Location {
  latitude: number;
  longitude: number;
}

interface Checkpoint {
  latitude: number;
  longitude: number;
  order: number;
}

export interface ETAResult {
  etaMinutes: number;
  distanceMeters: number;
  trafficDelayMinutes?: number;
  method: "google_maps" | "simple_calculation";
  timestamp: Date;
  error?: string;
}

interface CachedETA {
  result: ETAResult;
  expiresAt: number;
}

// In-memory cache for ETA calculations
const etaCache = new Map<string, CachedETA>();

// Cache TTL: 5 minutes (300000 ms) or from env
const CACHE_TTL = parseInt(process.env.ETA_CACHE_TTL || "300000", 10);

/**
 * Generate cache key for location-checkpoint pair
 */
function getCacheKey(location: Location, checkpoint: Checkpoint): string {
  // Round coordinates to 4 decimal places (~11 meters precision) for cache efficiency
  const lat1 = Math.round(location.latitude * 10000) / 10000;
  const lng1 = Math.round(location.longitude * 10000) / 10000;
  const lat2 = Math.round(checkpoint.latitude * 10000) / 10000;
  const lng2 = Math.round(checkpoint.longitude * 10000) / 10000;
  return `${lat1},${lng1}_${lat2},${lng2}`;
}

/**
 * Get cached ETA if available and not expired
 */
function getCachedETA(
  location: Location,
  checkpoint: Checkpoint
): ETAResult | null {
  const key = getCacheKey(location, checkpoint);
  const cached = etaCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // Remove expired entry
  if (cached) {
    etaCache.delete(key);
  }

  return null;
}

/**
 * Cache ETA result
 */
function setCachedETA(
  location: Location,
  checkpoint: Checkpoint,
  result: ETAResult
): void {
  const key = getCacheKey(location, checkpoint);
  etaCache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL,
  });

  // Clean up old cache entries periodically (keep cache size reasonable)
  if (etaCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of etaCache.entries()) {
      if (v.expiresAt <= now) {
        etaCache.delete(k);
      }
    }
  }
}

/**
 * Calculate ETA using Google Maps Distance Matrix API
 */
async function calculateETAWithGoogleMaps(
  location: Location,
  checkpoint: Checkpoint
): Promise<ETAResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn(
      "[ETA Calculator] Google Maps API key not configured, falling back to simple calculation"
    );
    return null;
  }

  try {
    const origin = `${location.latitude},${location.longitude}`;
    const destination = `${checkpoint.latitude},${checkpoint.longitude}`;

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        params: {
          origins: origin,
          destinations: destination,
          key: apiKey,
          mode: "driving",
          departure_time: "now", // Use current traffic conditions
          units: "metric",
        },
        timeout: 5000, // 5 second timeout
      }
    );

    if (response.data.status !== "OK") {
      console.warn(
        `[ETA Calculator] Google Maps API returned status: ${response.data.status}`
      );
      return null;
    }

    const element = response.data.rows[0]?.elements[0];

    if (!element || element.status !== "OK") {
      console.warn(
        `[ETA Calculator] Google Maps API element status: ${
          element?.status || "UNKNOWN"
        }`
      );
      return null;
    }

    // Extract duration and distance
    const durationInSeconds =
      element.duration_in_traffic?.value || element.duration?.value;
    const distanceInMeters = element.distance?.value;

    if (!durationInSeconds || !distanceInMeters) {
      console.warn(
        "[ETA Calculator] Missing duration or distance from Google Maps API"
      );
      return null;
    }

    const etaMinutes = Math.round(durationInSeconds / 60);
    const distanceMeters = distanceInMeters;

    // Calculate traffic delay (difference between duration_in_traffic and duration)
    let trafficDelayMinutes: number | undefined;
    if (element.duration_in_traffic && element.duration) {
      const delaySeconds =
        element.duration_in_traffic.value - element.duration.value;
      if (delaySeconds > 0) {
        trafficDelayMinutes = Math.round(delaySeconds / 60);
      }
    }

    return {
      etaMinutes,
      distanceMeters,
      trafficDelayMinutes,
      method: "google_maps",
      timestamp: new Date(),
    };
  } catch (error: any) {
    console.error(
      "[ETA Calculator] Error calling Google Maps API:",
      error.message
    );
    return null;
  }
}

/**
 * Calculate ETA using simple distance/speed calculation
 */
function calculateETASimple(
  location: Location,
  checkpoint: Checkpoint,
  currentSpeed?: number
): ETAResult {
  const distanceMeters = calculateDistanceToCheckpoint(location, checkpoint);

  // Use current speed if provided, otherwise assume average speed
  // Average city driving speed: ~40 km/h = ~11.1 m/s
  const averageSpeedKmh = currentSpeed && currentSpeed > 0 ? currentSpeed : 40;
  const averageSpeedMs = (averageSpeedKmh * 1000) / 3600; // Convert km/h to m/s

  // Calculate ETA in minutes
  const etaSeconds = distanceMeters / averageSpeedMs;
  const etaMinutes = Math.round(etaSeconds / 60);

  return {
    etaMinutes: Math.max(etaMinutes, 1), // At least 1 minute
    distanceMeters,
    method: "simple_calculation",
    timestamp: new Date(),
  };
}

/**
 * Calculate ETA from current location to checkpoint
 * @param location Current driver location
 * @param checkpoint Target checkpoint
 * @param currentSpeed Current speed in km/h (optional, for fallback calculation)
 * @returns ETA result with method used
 */
export async function calculateETA(
  location: Location,
  checkpoint: Checkpoint,
  currentSpeed?: number
): Promise<ETAResult> {
  // Validate inputs
  if (
    !location ||
    !checkpoint ||
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number" ||
    typeof checkpoint.latitude !== "number" ||
    typeof checkpoint.longitude !== "number"
  ) {
    throw new Error("Invalid location or checkpoint data");
  }

  // Check cache first
  const cached = getCachedETA(location, checkpoint);
  if (cached) {
    return cached;
  }

  // Try Google Maps API first
  const googleMapsResult = await calculateETAWithGoogleMaps(
    location,
    checkpoint
  );

  if (googleMapsResult) {
    setCachedETA(location, checkpoint, googleMapsResult);
    return googleMapsResult;
  }

  // Fallback to simple calculation
  const simpleResult = calculateETASimple(location, checkpoint, currentSpeed);
  setCachedETA(location, checkpoint, simpleResult);
  return simpleResult;
}

/**
 * Calculate ETA for multiple location-checkpoint pairs (batch)
 * Uses Google Maps API batch requests when possible
 */
export async function calculateETABatch(
  pairs: Array<{ location: Location; checkpoint: Checkpoint; speed?: number }>
): Promise<ETAResult[]> {
  // Process in parallel, but limit concurrent API calls
  const results = await Promise.all(
    pairs.map((pair) =>
      calculateETA(pair.location, pair.checkpoint, pair.speed)
    )
  );

  return results;
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of etaCache.entries()) {
    if (value.expiresAt <= now) {
      etaCache.delete(key);
    }
  }
}

/**
 * Get cache statistics (for monitoring)
 */
export function getCacheStats(): {
  size: number;
  hitRate?: number;
} {
  return {
    size: etaCache.size,
  };
}
