/**
 * User-friendly error message mapping
 * Converts technical errors into user-friendly messages
 */

import { AxiosError } from "axios";

export interface ErrorContext {
  screen?: string;
  action?: string;
  error?: Error | AxiosError;
}

/**
 * Get user-friendly error message from error
 */
export function getUserFriendlyErrorMessage(
  error: Error | AxiosError | any,
  context?: ErrorContext
): string {
  // Network errors
  if (error instanceof AxiosError) {
    if (!error.response) {
      // Network error - no response from server
      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        return "Request timed out. Please check your internet connection and try again.";
      }
      if (error.code === "ENOTFOUND" || error.code === "ECONNRESET") {
        return "Cannot connect to server. Please check your internet connection.";
      }
      return "Network error. Please check your internet connection and try again.";
    }

    // HTTP status code errors
    const status = error.response.status;
    const message = error.response.data?.message || error.message;

    switch (status) {
      case 400:
        return message || "Invalid request. Please check your input and try again.";
      case 401:
        return "Your session has expired. Please log in again.";
      case 403:
        return "You don't have permission to perform this action.";
      case 404:
        return "The requested resource was not found.";
      case 408:
        return "Request timed out. Please try again.";
      case 409:
        return "A conflict occurred. Please refresh and try again.";
      case 429:
        return "Too many requests. Please wait a moment and try again.";
      case 500:
        return "Server error. Our team has been notified. Please try again later.";
      case 502:
      case 503:
      case 504:
        return "Service temporarily unavailable. Please try again in a few moments.";
      default:
        return message || "An error occurred. Please try again.";
    }
  }

  // Generic error
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    // Location errors
    if (errorMessage.includes("location") || errorMessage.includes("permission")) {
      return "Location permission is required. Please enable it in your device settings.";
    }

    // Network errors
    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return "Network error. Please check your internet connection.";
    }

    // Timeout errors
    if (errorMessage.includes("timeout")) {
      return "Request timed out. Please try again.";
    }

    // Generic error message
    return error.message || "An unexpected error occurred. Please try again.";
  }

  // String error
  if (typeof error === "string") {
    return error;
  }

  // Unknown error
  return "An unexpected error occurred. Please try again.";
}

/**
 * Get error recovery suggestion
 */
export function getErrorRecoverySuggestion(
  error: Error | AxiosError | any
): string | null {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return "Check your internet connection and try again.";
    }

    const status = error.response.status;
    switch (status) {
      case 401:
        return "Please log in again to continue.";
      case 403:
        return "Contact support if you believe this is an error.";
      case 429:
        return "Wait a few seconds before trying again.";
      case 500:
      case 502:
      case 503:
      case 504:
        return "The server is experiencing issues. Please try again in a few moments.";
      default:
        return null;
    }
  }

  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes("location") || errorMessage.includes("permission")) {
      return "Go to Settings > Apps > Egoo > Permissions and enable Location.";
    }
    if (errorMessage.includes("network")) {
      return "Check your Wi-Fi or mobile data connection.";
    }
  }

  return null;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error | AxiosError | any): boolean {
  if (error instanceof AxiosError) {
    if (!error.response) {
      // Network errors are retryable
      return true;
    }

    const status = error.response.status;
    // Retry on these status codes
    return [408, 429, 500, 502, 503, 504].includes(status);
  }

  return false;
}

