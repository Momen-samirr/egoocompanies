import { AxiosError } from "axios";

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryableStatusCodes?: number[];
  retryableErrorCodes?: string[];
  onRetry?: (attempt: number, error: AxiosError) => void;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrorCodes: ["ECONNABORTED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"],
  onRetry: () => {},
};

/**
 * Calculate exponential backoff delay for retries
 */
export const getRetryDelay = (attempt: number, baseDelay: number = 1000): number => {
  return baseDelay * Math.pow(2, attempt);
};

/**
 * Check if an error should be retried
 */
export const shouldRetry = (error: AxiosError, attempt: number, config: RetryConfig = {}): boolean => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (attempt >= mergedConfig.maxRetries) {
    return false;
  }

  // Retry on network errors
  if (error.code && mergedConfig.retryableErrorCodes.includes(error.code)) {
    return true;
  }

  // Retry on specific HTTP status codes
  if (error.response && mergedConfig.retryableStatusCodes.includes(error.response.status)) {
    return true;
  }

  return false;
};

/**
 * Execute a function with retry logic
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: AxiosError | Error | null = null;

  for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as AxiosError | Error;

      // Check if we should retry
      if (attempt < mergedConfig.maxRetries) {
        if (error instanceof AxiosError && shouldRetry(error, attempt, mergedConfig)) {
          const delay = getRetryDelay(attempt, mergedConfig.retryDelay);
          
          if (mergedConfig.onRetry) {
            mergedConfig.onRetry(attempt + 1, error as AxiosError);
          }

          console.log(`🔄 Retrying (${attempt + 1}/${mergedConfig.maxRetries}) after ${delay}ms...`);
          
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      // If we shouldn't retry or max retries reached, throw the error
      throw error;
    }
  }

  throw lastError || new Error("Retry failed");
};

