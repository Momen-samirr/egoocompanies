/**
 * Location filtering utilities for improving GPS accuracy
 * Implements moving average and outlier detection
 */

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

/**
 * Location filter class for improving GPS accuracy
 * Uses weighted moving average and outlier detection
 */
export class LocationFilter {
  private history: LocationPoint[] = [];
  private readonly maxHistory = 5;

  /**
   * Filter location using moving average weighted by accuracy
   * @param location Raw location point from GPS
   * @returns Filtered location point
   */
  filter(location: LocationPoint): LocationPoint {
    // Add to history
    this.history.push(location);

    // Maintain history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // If accuracy is poor, use weighted average of history
    if (location.accuracy > 50) {
      return this.weightedAverage();
    }

    // If accuracy is good and no outliers, use current location
    if (!this.isOutlier(location)) {
      return location;
    }

    // If outlier detected, use weighted average
    return this.weightedAverage();
  }

  /**
   * Calculate weighted average of location history
   * Weights are inversely proportional to accuracy (lower accuracy = lower weight)
   */
  private weightedAverage(): LocationPoint {
    if (this.history.length === 0) {
      throw new Error("Cannot calculate average with empty history");
    }

    // Calculate weights (inverse of accuracy)
    const weights = this.history.map(
      (loc) => 1 / Math.max(loc.accuracy || 1, 1)
    );
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    let lat = 0;
    let lng = 0;
    let acc = 0;

    // Calculate weighted average
    this.history.forEach((loc, i) => {
      const weight = weights[i] / totalWeight;
      lat += loc.latitude * weight;
      lng += loc.longitude * weight;
      acc += loc.accuracy * weight;
    });

    return {
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect if a location is an outlier based on speed/distance
   * @param location Location to check
   * @returns True if location is likely an outlier
   */
  isOutlier(location: LocationPoint): boolean {
    if (this.history.length < 2) {
      return false; // Need at least 2 points to detect outliers
    }

    const lastLocation = this.history[this.history.length - 2];
    const distance = this.calculateDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      location.latitude,
      location.longitude
    );

    // Calculate time difference in seconds
    const timeDiff = (location.timestamp - lastLocation.timestamp) / 1000;

    // If time difference is invalid or zero, consider it an outlier
    if (timeDiff <= 0) {
      return true;
    }

    // Maximum realistic speed: 50 m/s (180 km/h)
    const maxSpeed = 50; // m/s
    const maxDistance = maxSpeed * timeDiff;

    // If distance exceeds maximum possible distance, it's an outlier
    if (distance > maxDistance) {
      return true;
    }

    // If accuracy is very poor (> 100m) and distance is large, likely outlier
    if (location.accuracy > 100 && distance > 200) {
      return true;
    }

    return false;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param lat1 Latitude of first point
   * @param lon1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lon2 Longitude of second point
   * @returns Distance in meters
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const toRad = (x: number) => (x * Math.PI) / 180;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Clear location history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Get current history size
   */
  getHistorySize(): number {
    return this.history.length;
  }
}

// Export singleton instance
export const locationFilter = new LocationFilter();
