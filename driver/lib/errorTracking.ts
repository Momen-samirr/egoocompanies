/**
 * Error tracking and logging utility
 * Provides centralized error handling and reporting
 */

interface ErrorContext {
  screen?: string;
  action?: string;
  userId?: string;
  additionalData?: Record<string, any>;
}

class ErrorTracker {
  private enabled: boolean = __DEV__; // Enable in development by default
  private errorLog: Array<{ error: Error; context: ErrorContext; timestamp: number }> = [];
  private maxLogSize: number = 100;

  /**
   * Enable or disable error tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Log an error with context
   */
  logError(error: Error | string, context: ErrorContext = {}): void {
    if (!this.enabled) {
      return;
    }

    const errorObj = typeof error === "string" ? new Error(error) : error;
    const errorEntry = {
      error: errorObj,
      context: {
        ...context,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    // Add to log
    this.errorLog.push(errorEntry);

    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Log to console in development
    if (__DEV__) {
      console.error("❌ Error tracked:", {
        message: errorObj.message,
        stack: errorObj.stack,
        context,
      });
    }

    // TODO: Integrate with error tracking service (Sentry, Bugsnag, etc.)
    // Example:
    // if (Sentry) {
    //   Sentry.captureException(errorObj, {
    //     tags: context,
    //   });
    // }
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context: ErrorContext = {}): void {
    if (!this.enabled) {
      return;
    }

    if (__DEV__) {
      console.warn("⚠️ Warning:", message, context);
    }

    // TODO: Send to error tracking service
  }

  /**
   * Log an info message
   */
  logInfo(message: string, context: ErrorContext = {}): void {
    if (!this.enabled) {
      return;
    }

    if (__DEV__) {
      console.log("ℹ️ Info:", message, context);
    }
  }

  /**
   * Get error log
   */
  getErrorLog(): Array<{ error: Error; context: ErrorContext; timestamp: number }> {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Set user context for error tracking
   */
  setUser(userId: string, additionalData?: Record<string, any>): void {
    // TODO: Set user context in error tracking service
    // Example:
    // if (Sentry) {
    //   Sentry.setUser({
    //     id: userId,
    //     ...additionalData,
    //   });
    // }
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    // TODO: Clear user context in error tracking service
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

/**
 * Wrapper function to catch and track errors in async functions
 */
export const trackAsyncError = async <T>(
  fn: () => Promise<T>,
  context: ErrorContext = {}
): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    errorTracker.logError(error as Error, context);
    return null;
  }
};

/**
 * Wrapper function to catch and track errors in sync functions
 */
export const trackSyncError = <T>(
  fn: () => T,
  context: ErrorContext = {}
): T | null => {
  try {
    return fn();
  } catch (error) {
    errorTracker.logError(error as Error, context);
    return null;
  }
};

/**
 * Global error handler for unhandled errors
 */
export const setupGlobalErrorHandler = (): void => {
  // Handle unhandled promise rejections
  if (typeof global !== "undefined") {
    const originalHandler = global.ErrorUtils?.getGlobalHandler?.();

    if (global.ErrorUtils?.setGlobalHandler) {
      global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        errorTracker.logError(error, {
          action: "unhandled_error",
          additionalData: { isFatal },
        });

        // Call original handler if it exists
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }
  }
};

// Setup global error handler on import
if (typeof window !== "undefined" || typeof global !== "undefined") {
  setupGlobalErrorHandler();
}

