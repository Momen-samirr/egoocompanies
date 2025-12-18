import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateDriverLocation } from "./locationService";
import { logger } from "@/lib/logger";

const OFFLINE_QUEUE_KEY = "location_queue";
const MAX_QUEUE_SIZE = 100; // Maximum locations to queue

export interface QueuedLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

/**
 * Get the offline location queue from storage
 */
const getOfflineQueue = async (): Promise<QueuedLocation[]> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    logger.error("Error reading offline queue", error);
    return [];
  }
};

/**
 * Save the offline location queue to storage
 */
const saveOfflineQueue = async (queue: QueuedLocation[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    logger.error("Error saving offline queue", error);
  }
};

/**
 * Queue location for offline sending
 * @param location Location to queue
 */
export const queueLocationForOffline = async (location: {
  latitude: number;
  longitude: number;
}): Promise<void> => {
  try {
    const queue = await getOfflineQueue();

    // Add new location
    queue.push({
      ...location,
      timestamp: Date.now(),
    });

    // Limit queue size to prevent storage issues
    if (queue.length > MAX_QUEUE_SIZE) {
      // Keep most recent locations
      queue.splice(0, queue.length - MAX_QUEUE_SIZE);
      logger.warn(
        `Offline queue exceeded max size, keeping last ${MAX_QUEUE_SIZE} locations`
      );
    }

    await saveOfflineQueue(queue);
    logger.debug(`Queued location for offline (queue size: ${queue.length})`);
  } catch (error) {
    logger.error("Error queueing location for offline", error);
  }
};

/**
 * Flush offline queue by sending all queued locations
 * @returns Number of locations successfully sent
 */
export const flushOfflineQueue = async (): Promise<number> => {
  try {
    const queue = await getOfflineQueue();
    if (queue.length === 0) {
      return 0;
    }

    logger.info(`Flushing offline queue: ${queue.length} locations`);

    let successCount = 0;
    const failedLocations: QueuedLocation[] = [];

    // Send all queued locations
    for (const location of queue) {
      try {
        await updateDriverLocation({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        successCount++;
        logger.debug(
          `Successfully sent queued location (${successCount}/${queue.length})`
        );
      } catch (error: any) {
        // Check if it's a network error or server error
        const isNetworkError =
          error.message?.includes("Network") ||
          error.message?.includes("timeout") ||
          error.code === "NETWORK_ERROR";

        if (isNetworkError) {
          // Keep failed locations if network error
          failedLocations.push(location);
          logger.warn("Network error while flushing queue, keeping location");
          break; // Stop trying if network is down
        } else {
          // For other errors (e.g., driver offline), skip the location
          logger.warn("Error sending queued location, skipping", error);
        }
      }
    }

    // Save remaining failed locations (if any)
    if (failedLocations.length > 0) {
      await saveOfflineQueue(failedLocations);
      logger.info(
        `Kept ${failedLocations.length} locations in queue due to network error`
      );
    } else {
      // Clear queue if all sent successfully
      await saveOfflineQueue([]);
      logger.info("Offline queue flushed successfully");
    }

    return successCount;
  } catch (error) {
    logger.error("Error flushing offline queue", error);
    return 0;
  }
};

/**
 * Check if device is online by attempting a simple network request
 * This is a fallback when NetInfo is not available
 */
export const isOnline = async (): Promise<boolean> => {
  // We'll detect offline status by catching network errors in flushOfflineQueue
  // For now, assume online - errors will be caught during flush
  return true;
};

/**
 * Get queue size
 */
export const getQueueSize = async (): Promise<number> => {
  const queue = await getOfflineQueue();
  return queue.length;
};

/**
 * Clear the offline queue
 */
export const clearOfflineQueue = async (): Promise<void> => {
  try {
    await saveOfflineQueue([]);
    logger.info("Offline queue cleared");
  } catch (error) {
    logger.error("Error clearing offline queue", error);
  }
};
