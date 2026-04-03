import React, { createContext, useCallback, useContext, useMemo } from "react";
import { applyLanguagePreference } from "@/lib/i18n/applyLanguage";
import type { AppLanguage } from "@/lib/i18n/constants";

type I18nActions = {
  applyLanguage: (language: AppLanguage) => Promise<void>;
};

const I18nActionsContext = createContext<I18nActions | null>(null);

export function I18nActionsProvider({ children }: { children: React.ReactNode }) {
  const applyLanguage = useCallback((language: AppLanguage) => {
    return applyLanguagePreference(language);
  }, []);

  const value = useMemo(() => ({ applyLanguage }), [applyLanguage]);

  return (
    <I18nActionsContext.Provider value={value}>{children}</I18nActionsContext.Provider>
  );
}

export function useI18nActions(): I18nActions {
  const ctx = useContext(I18nActionsContext);
  if (!ctx) {
    throw new Error("useI18nActions must be used within I18nActionsProvider");
  }
  return ctx;
}
