/**
 * Authentication utilities
 * Handles token storage, retrieval, and refresh logic
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const TOKEN_EXPIRY_KEY = "tokenExpiry";

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // seconds
}

/**
 * Store authentication tokens
 */
export async function storeTokens(data: TokenData): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);

    if (data.refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }

    // Calculate expiry time if expiresIn is provided
    if (data.expiresIn) {
      const expiryTime = Date.now() + data.expiresIn * 1000;
      await AsyncStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      logger.debug("Tokens stored with expiry", {
        expiresIn: data.expiresIn,
        expiryTime: new Date(expiryTime).toISOString(),
      });
    }

    logger.debug("Authentication tokens stored successfully");
  } catch (error) {
    logger.error("Error storing tokens", error);
    throw error;
  }
}

/**
 * Get access token
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    logger.error("Error getting access token", error);
    return null;
  }
}

/**
 * Get refresh token
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    logger.error("Error getting refresh token", error);
    return null;
  }
}

/**
 * Check if token is expired or will expire soon
 */
export async function isTokenExpired(bufferSeconds: number = 60): Promise<boolean> {
  try {
    const expiryTimeStr = await AsyncStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiryTimeStr) {
      // No expiry time stored - assume token is valid (for backward compatibility)
      return false;
    }

    const expiryTime = parseInt(expiryTimeStr, 10);
    const now = Date.now();
    const bufferTime = bufferSeconds * 1000;

    // Token is expired if current time + buffer is past expiry
    return now + bufferTime >= expiryTime;
  } catch (error) {
    logger.error("Error checking token expiry", error);
    // On error, assume token is expired to be safe
    return true;
  }
}

/**
 * Clear all authentication tokens
 */
export async function clearTokens(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      TOKEN_EXPIRY_KEY,
    ]);
    logger.debug("Authentication tokens cleared");
  } catch (error) {
    logger.error("Error clearing tokens", error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  refreshEndpoint: string
): Promise<TokenData | null> {
  try {
    const response = await fetch(refreshEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken,
      }),
    });

    if (!response.ok) {
      logger.error("Token refresh failed", {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = await response.json();
    
    if (data.accessToken) {
      const tokenData: TokenData = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || refreshToken, // Use new refresh token if provided
        expiresIn: data.expiresIn,
      };

      await storeTokens(tokenData);
      logger.info("Access token refreshed successfully");
      return tokenData;
    }

    logger.error("Invalid token refresh response", { data });
    return null;
  } catch (error) {
    logger.error("Error refreshing access token", error);
    return null;
  }
}

