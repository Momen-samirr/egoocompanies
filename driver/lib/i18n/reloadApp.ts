import { DevSettings, Platform } from "react-native";
import * as Updates from "expo-updates";

/**
 * Reloads the JS runtime so I18nManager RTL changes and i18n state apply reliably.
 * - Dev: always use DevSettings.reload (expo-updates reload is unreliable here).
 * - Prod: prefer expo-updates, fall back to DevSettings.reload.
 * - Web: full page reload.
 */
export async function reloadAppForLanguageChange(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof globalThis.location !== "undefined") {
      globalThis.location.reload();
    }
    return;
  }

  if (__DEV__) {
    DevSettings.reload();
    return;
  }

  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}
