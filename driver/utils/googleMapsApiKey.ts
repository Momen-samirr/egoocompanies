import Constants from "expo-constants";

type IosExpoConfig = {
  ios?: { config?: { googleMapsApiKey?: string } };
};

/**
 * Google Maps API key for Directions API / MapViewDirections.
 * Order: EAS or .env → Android app.json → iOS app.json.
 */
export function getGoogleMapsApiKey(): string {
  const envKey = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY?.trim();
  if (envKey) return envKey;

  const androidKey =
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey?.trim();
  if (androidKey) return androidKey;

  const iosKey = (
    Constants.expoConfig as IosExpoConfig | undefined
  )?.ios?.config?.googleMapsApiKey?.trim();
  if (iosKey) return iosKey;

  return "";
}
