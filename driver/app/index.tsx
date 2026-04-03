import React, { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DRIVER_ONBOARDING_COMPLETED_KEY } from "@/screens/onboarding/onboarding-one.screen";
import { getStoredLanguage } from "@/lib/i18n/storage";

/**
 * Entry redirect: if no language saved (@driver_app_language), send user to language selection once.
 * After a choice, applyLanguagePreference persists and reloads; next launch skips this step.
 */
export default function index() {
  const [isLoggedIn, setisLoggedIn] = useState(false);
  const [isOnboardingDone, setIsOnboardingDone] = useState(false);
  const [isLoading, setisLoading] = useState(true);
  const [hasChosenLanguage, setHasChosenLanguage] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const getData = async () => {
      try {
        const [accessToken, onboardingDone, storedLanguage] = await Promise.all([
          AsyncStorage.getItem("accessToken"),
          AsyncStorage.getItem(DRIVER_ONBOARDING_COMPLETED_KEY),
          getStoredLanguage(),
        ]);
        if (isMounted) {
          setisLoggedIn(!!accessToken);
          setIsOnboardingDone(onboardingDone === "true");
          setHasChosenLanguage(storedLanguage !== null);
        }
      } catch (error) {
        console.log(
          "Failed to retrieve access token from async storage",
          error
        );
      } finally {
        if (isMounted) {
          setisLoading(false);
        }
      }
    };

    getData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return null;
  }

  if (!hasChosenLanguage) {
    return <Redirect href="/(routes)/language-selection" />;
  }

  if (!isLoggedIn && !isOnboardingDone) {
    return <Redirect href="/(routes)/onboarding" />;
  }

  return <Redirect href={!isLoggedIn ? "/(routes)/login" : "/(tabs)/home"} />;
}
