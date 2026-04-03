export const DRIVER_APP_LANGUAGE_KEY = "@driver_app_language";

export const SUPPORTED_LANGUAGES = ["en", "ar"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isAppLanguage(value: string | null): value is AppLanguage {
  return value === "en" || value === "ar";
}

/** All translation namespaces (lazy-loaded via custom backend). */
export const I18N_NAMESPACES = [
  "common",
  "tabs",
  "auth",
  "onboarding",
  "home",
  "trips",
  "rides",
  "settings",
  "navigation",
  "profile",
  "documents",
  "components",
  "notifications",
  "permissions",
  "location",
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];
