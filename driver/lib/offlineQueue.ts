/**
 * Offline queue for API requests
 * Queues requests when offline and syncs when connection is restored
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosRequestConfig } from "axios";
import { logger } from "./logger";
import { apiClient } from "./apiClient";

const QUEUE_KEY = "offlineRequestQueue";
const MAX_QUEUE_SIZE = 100;

interface QueuedRequest {
  id: string;
  config: AxiosRequestConfig;
  timestamp: number;
  retries: number;
}

class OfflineQueue {
  private queue: QueuedRequest[] = [];
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private maxRetries: number = 3;

  /**
   * Initialize queue from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        logger.info(`Loaded ${this.queue.length} queued requests from storage`);
      }
    } catch (error) {
      logger.error("Error initializing offline queue", error);
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      logger.error("Error saving offline queue", error);
    }
  }

  /**
   * Set online/offline status
   */
  setOnlineStatus(isOnline: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;

    if (wasOffline && isOnline) {
      logger.info("Connection restored, syncing queued requests");
      this.syncQueue();
    } else if (!isOnline) {
      logger.info("Connection lost, requests will be queued");
    }
  }

  /**
   * Add request to queue
   */
  async enqueue(config: AxiosRequestConfig): Promise<void> {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      logger.warn("Offline queue is full, removing oldest request");
      this.queue.shift();
    }

    const queuedRequest: QueuedRequest = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      config,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedRequest);
    await this.saveQueue();

    logger.debug("Request queued for offline processing", {
      id: queuedRequest.id,
      url: config.url,
      method: config.method,
      queueSize: this.queue.length,
    });
  }

  /**
   * Process queue when online
   */
  async syncQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    logger.info(`Syncing ${this.queue.length} queued requests`);

    const requestsToProcess = [...this.queue];
    const successful: string[] = [];
    const failed: QueuedRequest[] = [];

    for (const request of requestsToProcess) {
      try {
        await apiClient(request.config);
        successful.push(request.id);
        logger.debug("Queued request processed successfully", {
          id: request.id,
          url: request.config.url,
        });
      } catch (error: any) {
        request.retries++;

        if (request.retries < this.maxRetries) {
          failed.push(request);
          logger.warn("Queued request failed, will retry", {
            id: request.id,
            retries: request.retries,
            error: error.message,
          });
        } else {
          logger.error("Queued request failed after max retries, removing", {
            id: request.id,
            url: request.config.url,
          });
        }
      }
    }

    // Remove successful requests and update failed ones
    this.queue = failed;
    await this.saveQueue();

    this.syncInProgress = false;

    logger.info("Queue sync completed", {
      successful: successful.length,
      failed: failed.length,
      remaining: this.queue.length,
    });
  }

  /**
   * Clear queue
   */
  async clear(): Promise<void> {
    this.queue = [];
    await AsyncStorage.removeItem(QUEUE_KEY);
    logger.info("Offline queue cleared");
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get queue
   */
  getQueue(): QueuedRequest[] {
    return [...this.queue];
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();

// Initialize on import
offlineQueue.initialize();

