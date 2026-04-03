import type { AppLanguage, I18nNamespace } from "@/lib/i18n/constants";

type JsonModule = { default: Record<string, unknown> };

type Loader = () => Promise<JsonModule>;

const enLoaders: Record<I18nNamespace, Loader> = {
  common: () => import("@/locales/en/common.json"),
  tabs: () => import("@/locales/en/tabs.json"),
  auth: () => import("@/locales/en/auth.json"),
  onboarding: () => import("@/locales/en/onboarding.json"),
  home: () => import("@/locales/en/home.json"),
  trips: () => import("@/locales/en/trips.json"),
  rides: () => import("@/locales/en/rides.json"),
  settings: () => import("@/locales/en/settings.json"),
  navigation: () => import("@/locales/en/navigation.json"),
  profile: () => import("@/locales/en/profile.json"),
  documents: () => import("@/locales/en/documents.json"),
  components: () => import("@/locales/en/components.json"),
  notifications: () => import("@/locales/en/notifications.json"),
  permissions: () => import("@/locales/en/permissions.json"),
  location: () => import("@/locales/en/location.json"),
};

const arLoaders: Record<I18nNamespace, Loader> = {
  common: () => import("@/locales/ar/common.json"),
  tabs: () => import("@/locales/ar/tabs.json"),
  auth: () => import("@/locales/ar/auth.json"),
  onboarding: () => import("@/locales/ar/onboarding.json"),
  home: () => import("@/locales/ar/home.json"),
  trips: () => import("@/locales/ar/trips.json"),
  rides: () => import("@/locales/ar/rides.json"),
  settings: () => import("@/locales/ar/settings.json"),
  navigation: () => import("@/locales/ar/navigation.json"),
  profile: () => import("@/locales/ar/profile.json"),
  documents: () => import("@/locales/ar/documents.json"),
  components: () => import("@/locales/ar/components.json"),
  notifications: () => import("@/locales/ar/notifications.json"),
  permissions: () => import("@/locales/ar/permissions.json"),
  location: () => import("@/locales/ar/location.json"),
};

const byLang: Record<AppLanguage, Record<I18nNamespace, Loader>> = {
  en: enLoaders,
  ar: arLoaders,
};

export async function loadNamespaceBundle(
  language: string,
  namespace: string
): Promise<Record<string, unknown>> {
  const lang = language === "ar" ? "ar" : "en";
  const ns = namespace as I18nNamespace;
  const loader = byLang[lang][ns];
  if (!loader) {
    throw new Error(`No loader for ${lang}/${namespace}`);
  }
  const mod = await loader();
  return mod.default as Record<string, unknown>;
}
