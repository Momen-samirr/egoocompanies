/**
 * Heading calculation utilities
 * Calculates bearing/heading from location history when GPS heading is unavailable
 */

export interface LocationWithTimestamp {
  latitude: number;
  longitude: number;
  timestamp: number;
}

/**
 * Calculate heading from location history
 * Uses the last two points to determine bearing
 * @param locations Array of location points with timestamps
 * @returns Bearing in degrees (0-360, where 0 is North), or null if insufficient data
 */
export const calculateHeadingFromHistory = (
  locations: LocationWithTimestamp[]
): number | null => {
  if (locations.length < 2) {
    return null;
  }

  // Use last two points
  const [prev, curr] = locations.slice(-2);

  // Convert to radians
  const lat1 = (prev.latitude * Math.PI) / 180;
  const lat2 = (curr.latitude * Math.PI) / 180;
  const deltaLon = ((curr.longitude - prev.longitude) * Math.PI) / 180;

  // Calculate bearing using atan2
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  // Normalize to 0-360 degrees
  return (bearing + 360) % 360;
};

/**
 * Location history buffer for maintaining recent locations
 */
export class LocationHistoryBuffer {
  private history: LocationWithTimestamp[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = 5) {
    this.maxSize = maxSize;
  }

  /**
   * Add location to history
   */
  add(location: LocationWithTimestamp): void {
    this.history.push(location);

    // Maintain max size
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
  }

  /**
   * Get all locations in history
   */
  getAll(): LocationWithTimestamp[] {
    return [...this.history];
  }

  /**
   * Get last N locations
   */
  getLast(n: number): LocationWithTimestamp[] {
    return this.history.slice(-n);
  }

  /**
   * Calculate heading from history
   */
  calculateHeading(): number | null {
    return calculateHeadingFromHistory(this.history);
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Get current size
   */
  size(): number {
    return this.history.length;
  }
}
