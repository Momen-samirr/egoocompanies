import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DRIVER_APP_LANGUAGE_KEY,
  type AppLanguage,
  isAppLanguage,
} from "@/lib/i18n/constants";

export async function getStoredLanguage(): Promise<AppLanguage | null> {
  const raw = await AsyncStorage.getItem(DRIVER_APP_LANGUAGE_KEY);
  if (raw == null || raw === "") return null;
  return isAppLanguage(raw) ? raw : null;
}

export async function setStoredLanguage(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(DRIVER_APP_LANGUAGE_KEY, language);
}
