/**
 * Simple in-memory cache for API responses
 * Provides TTL (Time To Live) based expiration
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class ApiCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number = 100; // Maximum number of cache entries

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache entry with TTL
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Remove specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Export singleton instance
export const apiCache = new ApiCache();

/**
 * Generate cache key from request config
 */
export const generateCacheKey = (
  method: string,
  url: string,
  params?: any,
  data?: any
): string => {
  const parts = [method.toUpperCase(), url];

  if (params) {
    parts.push(JSON.stringify(params));
  }

  if (data) {
    parts.push(JSON.stringify(data));
  }

  return parts.join("::");
};

/**
 * Default TTL values for different endpoints (in milliseconds)
 */
export const CACHE_TTL = {
  DRIVER_DATA: 2 * 60 * 1000,        // 2 minutes
  DRIVER_STATS: 1 * 60 * 1000,      // 1 minute
  STATIC_DATA: 30 * 60 * 1000,      // 30 minutes
  DEFAULT: 5 * 60 * 1000,            // 5 minutes
};

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    apiCache.cleanup();
  }, 5 * 60 * 1000);
}

