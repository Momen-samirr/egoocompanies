/**
 * Operations Management Configuration
 * Configurable thresholds and intervals for trip operations monitoring
 */

export interface OperationsConfig {
  // Delay detection
  delayThresholdMinutes: number; // Minutes late before alert is triggered
  alertUpdateIntervalMinutes: number; // How often to send updates while delayed

  // ETA calculation
  etaUpdateFrequencySeconds: number; // How often to recalculate ETA
  etaCacheTTL: number; // Cache TTL in milliseconds

  // Google Maps API
  googleMapsApiKey?: string;
  googleMapsTimeout: number; // Request timeout in milliseconds

  // Alert thresholds
  routeDeviationThreshold: number; // meters
  idleTimeThreshold: number; // minutes
  locationUpdateTimeout: number; // minutes
}

const defaultConfig: OperationsConfig = {
  delayThresholdMinutes: parseInt(
    process.env.DELAY_THRESHOLD_MINUTES || "5",
    10
  ),
  alertUpdateIntervalMinutes: parseInt(
    process.env.ALERT_UPDATE_INTERVAL_MINUTES || "5",
    10
  ),
  etaUpdateFrequencySeconds: parseInt(
    process.env.ETA_UPDATE_FREQUENCY_SECONDS || "30",
    10
  ),
  etaCacheTTL: parseInt(process.env.ETA_CACHE_TTL || "300000", 10), // 5 minutes
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  googleMapsTimeout: parseInt(process.env.GOOGLE_MAPS_TIMEOUT || "5000", 10),
  routeDeviationThreshold: parseInt(
    process.env.ROUTE_DEVIATION_THRESHOLD || "100",
    10
  ),
  idleTimeThreshold: parseInt(process.env.IDLE_TIME_THRESHOLD || "5", 10),
  locationUpdateTimeout: parseInt(
    process.env.LOCATION_UPDATE_TIMEOUT || "2",
    10
  ),
};

let config: OperationsConfig = { ...defaultConfig };

/**
 * Get current operations configuration
 */
export function getOperationsConfig(): OperationsConfig {
  return { ...config };
}

/**
 * Update operations configuration
 */
export function updateOperationsConfig(
  updates: Partial<OperationsConfig>
): void {
  config = { ...config, ...updates };
}

/**
 * Reset configuration to defaults
 */
export function resetOperationsConfig(): void {
  config = { ...defaultConfig };
}

export default config;
