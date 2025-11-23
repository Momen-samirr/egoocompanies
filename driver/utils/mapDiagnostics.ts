/**
 * Map diagnostics and validation utilities
 * Helps identify and debug map rendering issues
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

export interface MapDiagnostics {
  platform: string;
  hasApiKey: boolean;
  apiKeySource: string;
  googlePlayServicesAvailable: boolean | null;
  hardwareAccelerationSupported: boolean;
  deviceInfo: {
    model?: string;
    osVersion?: string;
    sdkVersion?: number;
  };
  errors: string[];
}

/**
 * Check if Google Maps API key is configured
 */
export function checkApiKey(): { hasKey: boolean; source: string; key?: string; allKeys?: { [key: string]: string } } {
  // Check from app.json config (Android)
  const androidKey = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
  
  // Check from environment variable
  const envKey = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
  
  const allKeys: { [key: string]: string } = {};
  if (androidKey) allKeys["app.json"] = androidKey;
  if (envKey) allKeys["environment"] = envKey;
  
  // Check for consistency
  const keys = Object.values(allKeys);
  const isConsistent = keys.length > 0 && keys.every(key => key === keys[0]);
  
  if (!isConsistent && keys.length > 1) {
    console.warn("⚠️ API key mismatch detected across configuration sources");
  }
  
  if (androidKey) {
    return { 
      hasKey: true, 
      source: "app.json (Android config)", 
      key: androidKey,
      allKeys: allKeys
    };
  }
  
  if (envKey) {
    return { 
      hasKey: true, 
      source: "Environment variable", 
      key: envKey,
      allKeys: allKeys
    };
  }
  
  return { hasKey: false, source: "Not found", allKeys: allKeys };
}

/**
 * Validate API key format (basic check)
 */
export function validateApiKeyFormat(key: string): boolean {
  // Google Maps API keys typically start with "AIza"
  return key && key.length > 20 && key.startsWith("AIza");
}

/**
 * Check Google Play Services availability (Android only)
 * Note: This requires native module access, so it's a placeholder
 * In production, you'd use react-native-google-play-services or similar
 */
export async function checkGooglePlayServices(): Promise<boolean | null> {
  if (Platform.OS !== "android") {
    return null; // Not applicable for iOS
  }
  
  // For now, we'll assume it's available if we're on Android
  // In production, you should use a native module to check
  // Example: import { GooglePlayServices } from 'react-native-google-play-services';
  // return await GooglePlayServices.isAvailable();
  
  return true; // Placeholder - implement with native module if needed
}

/**
 * Check if device supports hardware acceleration
 */
export function checkHardwareAcceleration(): boolean {
  // Most modern Android devices support hardware acceleration
  // This is a basic check - actual support depends on device capabilities
  if (Platform.OS === "android") {
    const sdkVersion = Platform.Version as number;
    // Hardware acceleration is generally available on API 14+
    return sdkVersion >= 14;
  }
  
  // iOS generally supports hardware acceleration
  return true;
}

/**
 * Get device information for diagnostics
 */
export function getDeviceInfo(): MapDiagnostics["deviceInfo"] {
  return {
    model: Constants.deviceName || undefined,
    osVersion: Platform.Version?.toString(),
    sdkVersion: Platform.OS === "android" ? (Platform.Version as number) : undefined,
  };
}

/**
 * Run comprehensive map diagnostics
 */
export async function runMapDiagnostics(): Promise<MapDiagnostics> {
  const errors: string[] = [];
  const apiKeyCheck = checkApiKey();
  
  if (!apiKeyCheck.hasKey) {
    errors.push("Google Maps API key not found in configuration");
  } else if (apiKeyCheck.key && !validateApiKeyFormat(apiKeyCheck.key)) {
    errors.push("Google Maps API key format appears invalid");
  }
  
  const googlePlayServices = await checkGooglePlayServices();
  if (Platform.OS === "android" && googlePlayServices === false) {
    errors.push("Google Play Services not available on this device");
  }
  
  const hardwareAccel = checkHardwareAcceleration();
  if (!hardwareAccel) {
    errors.push("Device may not support hardware acceleration");
  }
  
  return {
    platform: Platform.OS,
    hasApiKey: apiKeyCheck.hasKey,
    apiKeySource: apiKeyCheck.source,
    googlePlayServicesAvailable: googlePlayServices,
    hardwareAccelerationSupported: hardwareAccel,
    deviceInfo: getDeviceInfo(),
    errors,
  };
}

/**
 * Log map diagnostics to console with enhanced details
 */
export function logMapDiagnostics(diagnostics: MapDiagnostics): void {
  console.log("🗺️ ===== MAP DIAGNOSTICS =====");
  console.log("Platform:", diagnostics.platform);
  console.log("API Key:", diagnostics.hasApiKey ? "✅ Found" : "❌ Missing");
  console.log("API Key Source:", diagnostics.apiKeySource);
  
  // Log API key validation details
  const apiKeyCheck = checkApiKey();
  if (apiKeyCheck.allKeys && Object.keys(apiKeyCheck.allKeys).length > 1) {
    console.warn("⚠️ Multiple API keys found in different sources:");
    Object.entries(apiKeyCheck.allKeys).forEach(([source, key]) => {
      const isValid = validateApiKeyFormat(key);
      console.log(`  ${source}: ${key.substring(0, 10)}... (${isValid ? "✅ Valid format" : "❌ Invalid format"})`);
    });
  } else if (apiKeyCheck.key) {
    const isValid = validateApiKeyFormat(apiKeyCheck.key);
    console.log("API Key Format:", isValid ? "✅ Valid" : "❌ Invalid");
  }
  
  console.log("Google Play Services:", 
    diagnostics.googlePlayServicesAvailable === null 
      ? "N/A (iOS)" 
      : diagnostics.googlePlayServicesAvailable 
        ? "✅ Available" 
        : "❌ Not Available"
  );
  console.log("Hardware Acceleration:", 
    diagnostics.hardwareAccelerationSupported ? "✅ Supported" : "❌ Not Supported"
  );
  console.log("Device Info:", JSON.stringify(diagnostics.deviceInfo, null, 2));
  
  if (diagnostics.errors.length > 0) {
    console.error("❌ Errors found:");
    diagnostics.errors.forEach((error, index) => {
      console.error(`  ${index + 1}. ${error}`);
    });
  } else {
    console.log("✅ No errors detected");
  }
  console.log("=============================");
}

