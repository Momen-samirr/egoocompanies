/**
 * Toast notification manager
 * Provides queue management, priority levels, and grouping for toast notifications
 */

import { Toast } from "react-native-toast-notifications";
import { logger } from "./logger";

export type ToastType = "success" | "error" | "warning" | "info" | "danger";
export type ToastPriority = "low" | "normal" | "high" | "critical";

interface QueuedToast {
  id: string;
  message: string;
  type: ToastType;
  priority: ToastPriority;
  duration?: number;
  timestamp: number;
}

class ToastManager {
  private queue: QueuedToast[] = [];
  private maxQueueSize: number = 20;
  private maxConcurrentToasts: number = 3;
  private activeToasts: Set<string> = new Set();
  private groupedToasts: Map<string, number> = new Map(); // Group similar toasts
  private groupTimeout: number = 5000; // 5 seconds

  /**
   * Show toast with queue management
   */
  show(
    message: string,
    options: {
      type?: ToastType;
      priority?: ToastPriority;
      duration?: number;
      groupKey?: string; // Key for grouping similar toasts
    } = {}
  ): string | null {
    const {
      type = "info",
      priority = "normal",
      duration = 3000,
      groupKey,
    } = options;

    // Group similar toasts
    if (groupKey) {
      const count = this.groupedToasts.get(groupKey) || 0;
      this.groupedToasts.set(groupKey, count + 1);

      // If same toast shown recently, update count instead of showing new one
      if (count > 0) {
        logger.debug("Toast grouped", { groupKey, count: count + 1 });
        // Clear timeout to reset grouping window
        setTimeout(() => {
          this.groupedToasts.delete(groupKey);
        }, this.groupTimeout);
        return null; // Don't show duplicate
      }

      // Clear grouping after timeout
      setTimeout(() => {
        this.groupedToasts.delete(groupKey);
      }, this.groupTimeout);
    }

    // Check if we can show toast immediately
    if (this.activeToasts.size < this.maxConcurrentToasts) {
      return this.showToast(message, type, duration);
    }

    // Queue toast if limit reached
    if (this.queue.length >= this.maxQueueSize) {
      // Remove lowest priority toast
      this.queue.sort((a, b) => {
        const priorityOrder: Record<ToastPriority, number> = {
          critical: 4,
          high: 3,
          normal: 2,
          low: 1,
        };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      this.queue.pop(); // Remove lowest priority
    }

    const toast: QueuedToast = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      type,
      priority,
      duration,
      timestamp: Date.now(),
    };

    this.queue.push(toast);
    logger.debug("Toast queued", { id: toast.id, priority, queueSize: this.queue.length });

    // Process queue
    this.processQueue();

    return toast.id;
  }

  /**
   * Show toast immediately
   */
  private showToast(
    message: string,
    type: ToastType,
    duration: number
  ): string {
    const toastId = Toast.show(message, {
      type,
      duration,
      placement: "bottom",
    });

    if (toastId) {
      this.activeToasts.add(toastId.toString());
      
      // Remove from active set after duration
      setTimeout(() => {
        this.activeToasts.delete(toastId.toString());
        this.processQueue();
      }, duration);
    }

    return toastId?.toString() || "";
  }

  /**
   * Process queued toasts
   */
  private processQueue(): void {
    if (this.queue.length === 0 || this.activeToasts.size >= this.maxConcurrentToasts) {
      return;
    }

    // Sort queue by priority
    this.queue.sort((a, b) => {
      const priorityOrder: Record<ToastPriority, number> = {
        critical: 4,
        high: 3,
        normal: 2,
        low: 1,
      };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Show highest priority toast
    const toast = this.queue.shift();
    if (toast) {
      this.showToast(toast.message, toast.type, toast.duration || 3000);
    }
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    Toast.hideAll();
    this.activeToasts.clear();
    this.queue = [];
    logger.debug("All toasts dismissed");
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
    logger.debug("Toast queue cleared");
  }
}

// Export singleton instance
export const toastManager = new ToastManager();

// Convenience functions
export const showToast = (
  message: string,
  options?: {
    type?: ToastType;
    priority?: ToastPriority;
    duration?: number;
    groupKey?: string;
  }
) => toastManager.show(message, options);

export const dismissAllToasts = () => toastManager.dismissAll();

