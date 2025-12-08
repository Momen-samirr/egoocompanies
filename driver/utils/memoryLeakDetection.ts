/**
 * Memory leak detection utility
 * Helps identify potential memory leaks in development
 */

import { logger } from "@/lib/logger";

interface SubscriptionTracker {
  id: string;
  type: string;
  component: string;
  timestamp: number;
}

class MemoryLeakDetector {
  private subscriptions: Map<string, SubscriptionTracker> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Map<string, any> = new Map();
  private enabled: boolean = __DEV__;

  /**
   * Track a subscription
   */
  trackSubscription(id: string, type: string, component: string): void {
    if (!this.enabled) return;

    this.subscriptions.set(id, {
      id,
      type,
      component,
      timestamp: Date.now(),
    });

    logger.debug("Subscription tracked", { id, type, component });
  }

  /**
   * Untrack a subscription
   */
  untrackSubscription(id: string): void {
    if (!this.enabled) return;

    const subscription = this.subscriptions.get(id);
    if (subscription) {
      this.subscriptions.delete(id);
      logger.debug("Subscription untracked", { id, type: subscription.type });
    } else {
      logger.warn("Attempted to untrack unknown subscription", { id });
    }
  }

  /**
   * Track a timer
   */
  trackTimer(id: string, timeout: NodeJS.Timeout): void {
    if (!this.enabled) return;

    this.timers.set(id, timeout);
    logger.debug("Timer tracked", { id });
  }

  /**
   * Untrack a timer
   */
  untrackTimer(id: string): void {
    if (!this.enabled) return;

    if (this.timers.has(id)) {
      this.timers.delete(id);
      logger.debug("Timer untracked", { id });
    }
  }

  /**
   * Track an event listener
   */
  trackListener(id: string, listener: any): void {
    if (!this.enabled) return;

    this.listeners.set(id, listener);
    logger.debug("Listener tracked", { id });
  }

  /**
   * Untrack an event listener
   */
  untrackListener(id: string): void {
    if (!this.enabled) return;

    if (this.listeners.has(id)) {
      this.listeners.delete(id);
      logger.debug("Listener untracked", { id });
    }
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): SubscriptionTracker[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Check for potential memory leaks
   */
  checkForLeaks(): {
    subscriptions: number;
    timers: number;
    listeners: number;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check for old subscriptions (older than 5 minutes)
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    this.subscriptions.forEach((sub) => {
      if (sub.timestamp < fiveMinutesAgo) {
        warnings.push(
          `Potential leak: Subscription ${sub.id} (${sub.type}) in ${sub.component} is older than 5 minutes`
        );
      }
    });

    if (this.timers.size > 10) {
      warnings.push(`Many active timers detected: ${this.timers.size}`);
    }

    if (this.listeners.size > 20) {
      warnings.push(`Many active listeners detected: ${this.listeners.size}`);
    }

    return {
      subscriptions: this.subscriptions.size,
      timers: this.timers.size,
      listeners: this.listeners.size,
      warnings,
    };
  }

  /**
   * Log memory leak report
   */
  logReport(): void {
    if (!this.enabled) return;

    const report = this.checkForLeaks();
    logger.info("Memory leak detection report", report);

    if (report.warnings.length > 0) {
      logger.warn("Potential memory leaks detected", {
        warnings: report.warnings,
      });
    }
  }

  /**
   * Clear all tracking
   */
  clear(): void {
    this.subscriptions.clear();
    this.timers.clear();
    this.listeners.clear();
  }
}

// Export singleton instance
export const memoryLeakDetector = new MemoryLeakDetector();

// Log report periodically in development
if (__DEV__) {
  setInterval(() => {
    memoryLeakDetector.logReport();
  }, 5 * 60 * 1000); // Every 5 minutes
}

