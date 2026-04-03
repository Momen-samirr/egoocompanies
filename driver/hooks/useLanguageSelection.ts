import { useCallback, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useI18nActions } from "@/contexts/I18nActionsContext";
import type { AppLanguage } from "@/lib/i18n/constants";

/**
 * First-launch language picker: persist + i18n + RTL + reload (see applyLanguagePreference).
 * If apply throws before reload, navigates home so the user is not stuck.
 */
export function useLanguageSelection() {
  const { applyLanguage } = useI18nActions();
  const router = useRouter();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectLanguage = useCallback(
    async (language: AppLanguage) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setError(null);
      setBusy(true);
      try {
        await applyLanguage(language);
        // Successful path: reloadAppForLanguageChange() typically unmounts the app.
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not apply language";
        setError(message);
        busyRef.current = false;
        setBusy(false);
        router.replace("/");
      }
    },
    [applyLanguage, router]
  );

  return { busy, error, selectLanguage };
}
