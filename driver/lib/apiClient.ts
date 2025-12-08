import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getServerUri } from "@/configs/constants";
import { getAccessToken, getRefreshToken, refreshAccessToken, isTokenExpired, clearTokens } from "./auth";
import { logger } from "./logger";
import { offlineQueue } from "./offlineQueue";

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const RETRYABLE_ERROR_CODES = ["ECONNABORTED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"];

/**
 * Calculate exponential backoff delay for retries
 */
const getRetryDelay = (attempt: number): number => {
  return RETRY_DELAY * Math.pow(2, attempt);
};

/**
 * Check if an error should be retried
 */
const shouldRetry = (error: AxiosError, attempt: number): boolean => {
  if (attempt >= MAX_RETRIES) {
    return false;
  }

  // Retry on network errors
  if (error.code && RETRYABLE_ERROR_CODES.includes(error.code)) {
    return true;
  }

  // Retry on specific HTTP status codes
  if (error.response && RETRYABLE_STATUS_CODES.includes(error.response.status)) {
    return true;
  }

  return false;
};

/**
 * Create configured axios instance with interceptors
 */
const createApiClient = (): AxiosInstance => {
  const apiClient = axios.create({
    baseURL: getServerUri(),
    timeout: 30000, // 30 seconds default timeout
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor - Add auth token to requests and refresh if needed
  apiClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Check if token is expired or will expire soon
      const tokenExpired = await isTokenExpired(60); // 60 second buffer
      
      if (tokenExpired) {
        logger.debug("Token expired or expiring soon, attempting refresh");
        const refreshToken = await getRefreshToken();
        
        if (refreshToken) {
          try {
            const refreshed = await refreshAccessToken(
              refreshToken,
              `${getServerUri()}/auth/refresh` // Adjust endpoint as needed
            );
            
            if (refreshed) {
              logger.info("Token refreshed successfully before request");
            } else {
              logger.warn("Token refresh failed, clearing tokens");
              await clearTokens();
            }
          } catch (error) {
            logger.error("Error refreshing token in request interceptor", error);
          }
        }
      }

      // Get access token from storage
      const accessToken = await getAccessToken();
      
      if (accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      // Log request in development
      logger.debug(`Request: ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
        params: config.params,
      });

      return config;
    },
    (error: AxiosError) => {
      logger.error("Request error", error);
      return Promise.reject(error);
    }
  );

  // Response interceptor - Handle errors and retries
  apiClient.interceptors.response.use(
    (response) => {
      // Log response in development
      logger.debug(`Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
      });
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

      // Handle 401 Unauthorized - Token expired or invalid
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = await getRefreshToken();
          
          if (refreshToken) {
            logger.info("Attempting to refresh token after 401 error");
            const refreshed = await refreshAccessToken(
              refreshToken,
              `${getServerUri()}/auth/refresh` // Adjust endpoint as needed
            );
            
            if (refreshed && refreshed.accessToken) {
              // Retry the original request with new token
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
              }
              logger.info("Token refreshed, retrying original request");
              return apiClient(originalRequest);
            }
          }
          
          // Refresh failed or no refresh token - clear tokens
          logger.warn("Token refresh failed or no refresh token available. Clearing tokens.");
          await clearTokens();
          
          // You can dispatch an event or navigate to login screen here
          // For now, we'll just reject the request
          return Promise.reject(error);
        } catch (refreshError) {
          logger.error("Token refresh failed", refreshError);
          await clearTokens();
          return Promise.reject(error);
        }
      }

      // Handle retry logic
      const retryCount = originalRequest._retryCount || 0;

      if (shouldRetry(error, retryCount)) {
        originalRequest._retryCount = retryCount + 1;
        const delay = getRetryDelay(retryCount);

        logger.debug(`Retrying request (${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms`);

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Retry the request
        return apiClient(originalRequest);
      }

      // If offline and request is not a retry, queue it
      if (
        !error.response && // Network error (no response)
        error.code &&
        (error.code === "ECONNABORTED" || error.code === "ENOTFOUND" || error.code === "ECONNRESET")
      ) {
        // Check if this is a POST, PUT, or DELETE request (should be queued)
        const method = error.config?.method?.toUpperCase();
        if (method && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
          logger.info("Network error detected, queueing request for offline processing");
          await offlineQueue.enqueue(error.config as AxiosRequestConfig);
        }
      }

      // Log error
      logger.error(`Request failed: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error, {
        status: error.response?.status,
        data: error.response?.data,
      });

      return Promise.reject(error);
    }
  );

  return apiClient;
};

// Export singleton instance
export const apiClient = createApiClient();

// Export types
export type { AxiosInstance, AxiosError, AxiosRequestConfig };

