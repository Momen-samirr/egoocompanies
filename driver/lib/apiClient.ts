import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getServerUri } from "@/configs/constants";

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

  // Request interceptor - Add auth token to requests
  apiClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Get access token from storage
      const accessToken = await AsyncStorage.getItem("accessToken");
      
      if (accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      // Log request in development
      if (__DEV__) {
        console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`, {
          data: config.data,
          params: config.params,
        });
      }

      return config;
    },
    (error: AxiosError) => {
      console.error("❌ Request error:", error);
      return Promise.reject(error);
    }
  );

  // Response interceptor - Handle errors and retries
  apiClient.interceptors.response.use(
    (response) => {
      // Log response in development
      if (__DEV__) {
        console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, {
          status: response.status,
          data: response.data,
        });
      }
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

      // Handle 401 Unauthorized - Token expired or invalid
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          // Try to refresh token (implement your refresh logic here)
          // For now, we'll just clear the token and let the app handle re-authentication
          await AsyncStorage.removeItem("accessToken");
          
          console.warn("⚠️ Token expired or invalid. Please login again.");
          
          // You can dispatch an event or navigate to login screen here
          // For now, we'll just reject the request
          return Promise.reject(error);
        } catch (refreshError) {
          console.error("❌ Token refresh failed:", refreshError);
          return Promise.reject(error);
        }
      }

      // Handle retry logic
      const retryCount = originalRequest._retryCount || 0;

      if (shouldRetry(error, retryCount)) {
        originalRequest._retryCount = retryCount + 1;
        const delay = getRetryDelay(retryCount);

        console.log(`🔄 Retrying request (${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms...`);

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Retry the request
        return apiClient(originalRequest);
      }

      // Log error in development
      if (__DEV__) {
        console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
      }

      return Promise.reject(error);
    }
  );

  return apiClient;
};

// Export singleton instance
export const apiClient = createApiClient();

// Export types
export type { AxiosInstance, AxiosError, AxiosRequestConfig };

