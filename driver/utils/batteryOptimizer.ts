/**
 * Battery optimization utilities
 * Adaptive update frequency based on battery level
 */

export interface UpdateFrequency {
  timeInterval: number;
  distanceInterval: number;
}

/**
 * Get update frequency based on battery level and movement
 * @param batteryLevel Battery level (0-1, where 1 is 100%)
 * @param isMoving Whether the device is currently moving
 * @param speed Current speed in m/s (optional)
 * @returns Update frequency configuration
 */
export const getUpdateFrequency = (
  batteryLevel: number,
  isMoving: boolean,
  speed?: number | null
): UpdateFrequency => {
  // Low battery (< 20%): reduce frequency significantly
  if (batteryLevel < 0.2) {
    return {
      timeInterval: 30000, // 30 seconds
      distanceInterval: 100, // 100 meters
    };
  }

  // Medium battery (20-50%): moderate frequency
  if (batteryLevel < 0.5) {
    return {
      timeInterval: 15000, // 15 seconds
      distanceInterval: 50, // 50 meters
    };
  }

  // High battery (> 50%): use normal frequency
  // Adjust based on movement
  if (!isMoving || (speed !== null && speed !== undefined && speed < 1)) {
    // Not moving: reduce frequency
    return {
      timeInterval: 60000, // 1 minute
      distanceInterval: 50, // 50 meters
    };
  }

  // Moving fast: increase frequency for accuracy
  if (speed !== null && speed !== undefined && speed > 10) {
    return {
      timeInterval: 5000, // 5 seconds
      distanceInterval: 20, // 20 meters
    };
  }

  // Default: balanced frequency
  return {
    timeInterval: 10000, // 10 seconds
    distanceInterval: 50, // 50 meters
  };
};

/**
 * Check if device is charging
 * Note: This requires expo-battery package (Phase 4)
 */
export const isCharging = async (): Promise<boolean> => {
  try {
    // Try to import expo-battery if available
    const Battery = require("expo-battery");
    if (Battery && Battery.getBatteryStateAsync) {
      const batteryState = await Battery.getBatteryStateAsync();
      return batteryState === Battery.BatteryState.CHARGING;
    }
  } catch (error) {
    // expo-battery not available, assume not charging
  }
  return false;
};

/**
 * Get battery level
 * Note: This requires expo-battery package (Phase 4)
 */
export const getBatteryLevel = async (): Promise<number | null> => {
  try {
    const Battery = require("expo-battery");
    if (Battery && Battery.getBatteryLevelAsync) {
      const level = await Battery.getBatteryLevelAsync();
      return level;
    }
  } catch (error) {
    // expo-battery not available
  }
  return null;
};
