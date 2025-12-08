/**
 * Production-safe logger utility
 * Provides environment-based logging with sanitization for sensitive data
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: number;
}

class Logger {
  private isDevelopment: boolean = __DEV__;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize: number = 100;
  private batchInterval: number = 5000; // 5 seconds
  private batchTimer: NodeJS.Timeout | null = null;

  // Patterns to detect and sanitize sensitive data
  private sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /api[_-]?key/i,
    /authorization/i,
    /bearer/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /credit[_-]?card/i,
    /ssn/i,
    /social[_-]?security/i,
  ];

  /**
   * Sanitize data to remove sensitive information
   */
  private sanitize(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === "string") {
      // Check if string contains sensitive patterns
      for (const pattern of this.sensitivePatterns) {
        if (pattern.test(data)) {
          return "[REDACTED]";
        }
      }
      return data;
    }

    if (typeof data === "object") {
      if (Array.isArray(data)) {
        return data.map((item) => this.sanitize(item));
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Check if key indicates sensitive data
        const isSensitive = this.sensitivePatterns.some((pattern) =>
          pattern.test(key)
        );
        if (isSensitive) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Format log entry for output
   */
  private formatLog(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const sanitizedData = data ? this.sanitize(data) : undefined;

    if (sanitizedData) {
      return `[${timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(
        sanitizedData,
        null,
        2
      )}`;
    }
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Add log entry to buffer
   */
  private addToBuffer(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      level,
      message,
      data: data ? this.sanitize(data) : undefined,
      timestamp: Date.now(),
    };

    this.logBuffer.push(entry);

    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  /**
   * Flush log buffer (for production, could send to logging service)
   */
  private flushBuffer(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    // In production, you could send these logs to a logging service
    // For now, we'll just clear the buffer
    if (!this.isDevelopment) {
      // TODO: Send to logging service (Sentry, LogRocket, etc.)
      // Example: loggingService.sendBatch(this.logBuffer);
    }

    this.logBuffer = [];
  }

  /**
   * Debug log (only in development)
   */
  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(this.formatLog("debug", message, data));
    }
    this.addToBuffer("debug", message, data);
  }

  /**
   * Info log
   */
  info(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(this.formatLog("info", message, data));
    }
    this.addToBuffer("info", message, data);
  }

  /**
   * Warning log
   */
  warn(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.warn(this.formatLog("warn", message, data));
    }
    this.addToBuffer("warn", message, data);
  }

  /**
   * Error log
   */
  error(message: string, error?: Error | any, data?: any): void {
    const errorData =
      error instanceof Error
        ? { message: error.message, stack: error.stack, ...data }
        : { error, ...data };

    if (this.isDevelopment) {
      console.error(this.formatLog("error", message, errorData));
    }
    this.addToBuffer("error", message, errorData);

    // In production, send errors to error tracking service
    if (!this.isDevelopment) {
      // TODO: Send to error tracking service (Sentry, Bugsnag, etc.)
      // Example: errorTrackingService.captureException(error, { extra: data });
    }
  }

  /**
   * Get log buffer (for debugging)
   */
  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Start batch logging (for production)
   */
  startBatchLogging(): void {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setInterval(() => {
      this.flushBuffer();
    }, this.batchInterval);
  }

  /**
   * Stop batch logging
   */
  stopBatchLogging(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.flushBuffer();
  }
}

// Export singleton instance
export const logger = new Logger();

// Start batch logging in production
if (!__DEV__) {
  logger.startBatchLogging();
}

// Convenience functions for common log patterns
export const logDebug = (message: string, data?: any) =>
  logger.debug(message, data);
export const logInfo = (message: string, data?: any) =>
  logger.info(message, data);
export const logWarn = (message: string, data?: any) =>
  logger.warn(message, data);
export const logError = (message: string, error?: Error | any, data?: any) =>
  logger.error(message, error, data);

