/**
 * Unit tests for error message utilities
 */

import {
  getUserFriendlyErrorMessage,
  getErrorRecoverySuggestion,
  isRetryableError,
} from "@/lib/errorMessages";
import { AxiosError } from "axios";

describe("Error Messages", () => {
  test("should return user-friendly message for network error", () => {
    const error = new AxiosError("Network Error");
    error.code = "ENOTFOUND";
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain("internet connection");
  });

  test("should return user-friendly message for 401 error", () => {
    const error = new AxiosError("Unauthorized");
    error.response = {
      status: 401,
      data: { message: "Token expired" },
    } as any;
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain("session has expired");
  });

  test("should return recovery suggestion for 401", () => {
    const error = new AxiosError("Unauthorized");
    error.response = {
      status: 401,
    } as any;
    const suggestion = getErrorRecoverySuggestion(error);
    expect(suggestion).toContain("log in again");
  });

  test("should identify retryable errors", () => {
    const networkError = new AxiosError("Network Error");
    networkError.code = "ECONNABORTED";
    expect(isRetryableError(networkError)).toBe(true);

    const serverError = new AxiosError("Server Error");
    serverError.response = { status: 500 } as any;
    expect(isRetryableError(serverError)).toBe(true);

    const clientError = new AxiosError("Bad Request");
    clientError.response = { status: 400 } as any;
    expect(isRetryableError(clientError)).toBe(false);
  });
});

