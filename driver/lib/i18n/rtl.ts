import { I18nManager } from "react-native";
import type { AppLanguage } from "@/lib/i18n/constants";

export function syncLayoutDirectionForLanguage(language: AppLanguage): void {
  const isRtl = language === "ar";
  I18nManager.allowRTL(true);
  I18nManager.swapLeftAndRightInRTL(true);
  I18nManager.forceRTL(isRtl);
}
