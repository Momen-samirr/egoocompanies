import { apiClient } from "@/lib/apiClient";
import { apiCache, generateCacheKey, CACHE_TTL } from "@/lib/apiCache";

export interface LocationUpdate {
  latitude: number;
  longitude: number;
}

export interface LocationUpdateResponse {
  success: boolean;
  activationChecks?: Array<{
    tripId: string;
    canActivate: boolean;
  }>;
}

/**
 * Update driver location
 * This is used for scheduled trips location tracking
 */
export const updateDriverLocation = async (
  location: LocationUpdate
): Promise<LocationUpdateResponse> => {
  try {
    const response = await apiClient.post<LocationUpdateResponse>(
      "/driver/update-location",
      location
    );
    return response.data;
  } catch (error: any) {
    console.error("Error updating driver location:", error);
    throw error;
  }
};

/**
 * Get driver location (if stored on server)
 */
export const getDriverLocation = async (): Promise<LocationUpdate | null> => {
  try {
    const cacheKey = generateCacheKey("GET", "/driver/location");
    const cached = apiCache.get<LocationUpdate>(cacheKey);

    if (cached) {
      return cached;
    }

    const response = await apiClient.get<{ location: LocationUpdate }>(
      "/driver/location"
    );

    if (response.data.location) {
      apiCache.set(cacheKey, response.data.location, CACHE_TTL.DEFAULT);
      return response.data.location;
    }

    return null;
  } catch (error: any) {
    console.error("Error getting driver location:", error);
    return null;
  }
};

/**
 * Batch location updates
 */
interface BatchedLocationUpdate {
  locations: Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
  }>;
}

let locationQueue: Array<{
  latitude: number;
  longitude: number;
  timestamp: number;
}> = [];
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_SIZE = 5;
const BATCH_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Queue location for batch update
 */
export const queueLocationUpdate = async (
  location: LocationUpdate
): Promise<void> => {
  locationQueue.push({
    ...location,
    timestamp: Date.now(),
  });

  // Send batch if queue is full
  if (locationQueue.length >= BATCH_SIZE) {
    await flushLocationBatch();
  } else {
    // Set timeout to flush queue
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }
    batchTimeout = setTimeout(() => {
      flushLocationBatch();
    }, BATCH_TIMEOUT_MS);
  }
};

/**
 * Flush location batch
 */
const flushLocationBatch = async (): Promise<void> => {
  if (locationQueue.length === 0) return;

  const batch = [...locationQueue];
  locationQueue = [];

  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }

  try {
    // Send most recent location (for real-time tracking)
    const latest = batch[batch.length - 1];
    await updateDriverLocation(latest);

    // Optionally send batch for historical tracking
    // This would require a new endpoint on the server
    // await apiClient.post("/driver/location-batch", { locations: batch });
  } catch (error) {
    console.error("Error flushing location batch:", error);
  }
};
