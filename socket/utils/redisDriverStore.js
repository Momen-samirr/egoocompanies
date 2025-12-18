/**
 * Redis-based driver location storage
 * Provides TTL-based expiration and distributed state management
 */

const DRIVER_TTL = 600; // 10 minutes in seconds
const DRIVER_KEY_PREFIX = "driver:";

class RedisDriverStore {
  constructor(redis, fallbackStore = null) {
    this.redis = redis;
    this.fallbackStore = fallbackStore; // In-memory fallback
    this.enabled = redis !== null;
  }

  /**
   * Store driver location in Redis with TTL
   * @param {string} driverId Driver ID
   * @param {object} driverData Driver location data
   * @returns {Promise<object>} Stored driver data
   */
  async setDriver(driverId, driverData) {
    const key = `${DRIVER_KEY_PREFIX}${driverId}`;
    const data = {
      ...driverData,
      id: driverId,
      timestamp: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };

    if (this.enabled && this.redis) {
      try {
        await this.redis.setex(key, DRIVER_TTL, JSON.stringify(data));
        console.log(
          `✅ [Redis] Stored driver ${driverId} with TTL ${DRIVER_TTL}s`
        );
      } catch (error) {
        console.error(
          `❌ [Redis] Error storing driver ${driverId}:`,
          error.message
        );
        // Fallback to in-memory storage
        if (this.fallbackStore) {
          this.fallbackStore[driverId] = data;
        }
      }
    } else {
      // Fallback to in-memory storage
      if (this.fallbackStore) {
        this.fallbackStore[driverId] = data;
      }
    }

    return data;
  }

  /**
   * Get driver location from Redis
   * @param {string} driverId Driver ID
   * @returns {Promise<object|null>} Driver data or null if not found
   */
  async getDriver(driverId) {
    const key = `${DRIVER_KEY_PREFIX}${driverId}`;

    if (this.enabled && this.redis) {
      try {
        const data = await this.redis.get(key);
        if (data) {
          return JSON.parse(data);
        }
      } catch (error) {
        console.error(
          `❌ [Redis] Error getting driver ${driverId}:`,
          error.message
        );
        // Fallback to in-memory storage
        if (this.fallbackStore && this.fallbackStore[driverId]) {
          return this.fallbackStore[driverId];
        }
      }
    } else {
      // Fallback to in-memory storage
      if (this.fallbackStore && this.fallbackStore[driverId]) {
        return this.fallbackStore[driverId];
      }
    }

    return null;
  }

  /**
   * Get all drivers from Redis
   * @returns {Promise<object>} Object with driverId as keys and driver data as values
   */
  async getAllDrivers() {
    const drivers = {};

    if (this.enabled && this.redis) {
      try {
        const keys = await this.redis.keys(`${DRIVER_KEY_PREFIX}*`);
        if (keys.length > 0) {
          const values = await this.redis.mget(keys);
          values.forEach((value, index) => {
            if (value) {
              try {
                const driverData = JSON.parse(value);
                const driverId =
                  driverData.id || keys[index].replace(DRIVER_KEY_PREFIX, "");
                drivers[driverId] = driverData;
              } catch (parseError) {
                console.error(
                  `❌ [Redis] Error parsing driver data:`,
                  parseError
                );
              }
            }
          });
        }
        console.log(
          `✅ [Redis] Loaded ${Object.keys(drivers).length} drivers from Redis`
        );
      } catch (error) {
        console.error(`❌ [Redis] Error getting all drivers:`, error.message);
        // Fallback to in-memory storage
        if (this.fallbackStore) {
          Object.assign(drivers, this.fallbackStore);
        }
      }
    } else {
      // Fallback to in-memory storage
      if (this.fallbackStore) {
        Object.assign(drivers, this.fallbackStore);
      }
    }

    return drivers;
  }

  /**
   * Remove driver from Redis
   * @param {string} driverId Driver ID
   * @returns {Promise<boolean>} True if removed, false otherwise
   */
  async removeDriver(driverId) {
    const key = `${DRIVER_KEY_PREFIX}${driverId}`;

    if (this.enabled && this.redis) {
      try {
        const result = await this.redis.del(key);
        console.log(`✅ [Redis] Removed driver ${driverId}`);
        return result > 0;
      } catch (error) {
        console.error(
          `❌ [Redis] Error removing driver ${driverId}:`,
          error.message
        );
      }
    }

    // Also remove from fallback
    if (this.fallbackStore && this.fallbackStore[driverId]) {
      delete this.fallbackStore[driverId];
      return true;
    }

    return false;
  }

  /**
   * Update driver TTL (refresh expiration)
   * @param {string} driverId Driver ID
   * @returns {Promise<boolean>} True if TTL was updated
   */
  async refreshTTL(driverId) {
    const key = `${DRIVER_KEY_PREFIX}${driverId}`;

    if (this.enabled && this.redis) {
      try {
        const result = await this.redis.expire(key, DRIVER_TTL);
        return result === 1;
      } catch (error) {
        console.error(
          `❌ [Redis] Error refreshing TTL for driver ${driverId}:`,
          error.message
        );
      }
    }

    return false;
  }

  /**
   * Get count of drivers
   * @returns {Promise<number>} Number of drivers
   */
  async getDriverCount() {
    if (this.enabled && this.redis) {
      try {
        const keys = await this.redis.keys(`${DRIVER_KEY_PREFIX}*`);
        return keys.length;
      } catch (error) {
        console.error(`❌ [Redis] Error getting driver count:`, error.message);
      }
    }

    // Fallback to in-memory storage
    if (this.fallbackStore) {
      return Object.keys(this.fallbackStore).length;
    }

    return 0;
  }

  /**
   * Clear all drivers (use with caution)
   * @returns {Promise<number>} Number of drivers cleared
   */
  async clearAll() {
    let count = 0;

    if (this.enabled && this.redis) {
      try {
        const keys = await this.redis.keys(`${DRIVER_KEY_PREFIX}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          count = keys.length;
        }
        console.log(`✅ [Redis] Cleared ${count} drivers`);
      } catch (error) {
        console.error(`❌ [Redis] Error clearing all drivers:`, error.message);
      }
    }

    // Also clear fallback
    if (this.fallbackStore) {
      const fallbackCount = Object.keys(this.fallbackStore).length;
      Object.keys(this.fallbackStore).forEach((key) => {
        delete this.fallbackStore[key];
      });
      count += fallbackCount;
    }

    return count;
  }
}

module.exports = RedisDriverStore;
