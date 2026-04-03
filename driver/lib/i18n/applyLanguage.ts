import { getI18nInstance } from "@/lib/i18n/instance";
import { setStoredLanguage } from "@/lib/i18n/storage";
import { syncLayoutDirectionForLanguage } from "@/lib/i18n/rtl";
import { reloadAppForLanguageChange } from "@/lib/i18n/reloadApp";
import type { AppLanguage } from "@/lib/i18n/constants";

export async function applyLanguagePreference(language: AppLanguage): Promise<void> {
  await setStoredLanguage(language);
  await getI18nInstance().changeLanguage(language);
  syncLayoutDirectionForLanguage(language);
  await reloadAppForLanguageChange();
}
