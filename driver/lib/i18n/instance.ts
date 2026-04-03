import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { BackendModule } from "i18next";
import { I18N_NAMESPACES, type AppLanguage } from "@/lib/i18n/constants";
import { loadNamespaceBundle } from "@/lib/i18n/resourceLoaders";

const lazyBackend: BackendModule = {
  type: "backend",
  init() {},
  read(language, namespace, callback) {
    loadNamespaceBundle(language, namespace)
      .then((data) => callback(null, data))
      .catch((err: Error) => callback(err, false));
  },
};

let initPromise: Promise<typeof i18n> | null = null;

export function initI18n(initialLanguage: AppLanguage): Promise<typeof i18n> {
  if (i18n.isInitialized) {
    return Promise.resolve(i18n);
  }
  if (initPromise) {
    return initPromise;
  }
  initPromise = i18n
    .use(lazyBackend)
    .use(initReactI18next)
    .init({
      lng: initialLanguage,
      fallbackLng: "en",
      supportedLngs: ["en", "ar"],
      ns: [...I18N_NAMESPACES],
      defaultNS: "common",
      interpolation: { escapeValue: false },
      returnNull: false,
      react: { useSuspense: false },
      partialBundledLanguages: true,
    })
    .then(() =>
      i18n
        .loadNamespaces([
          "common",
          "tabs",
          "home",
          "notifications",
          "trips",
          "location",
          "permissions",
        ])
        .then(() => i18n)
    );
  return initPromise;
}

export function getI18nInstance(): typeof i18n {
  return i18n;
}

export { i18n };
