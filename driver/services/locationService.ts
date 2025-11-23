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

