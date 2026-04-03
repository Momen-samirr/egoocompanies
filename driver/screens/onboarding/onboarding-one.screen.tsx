import React, { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import KineticOnboardingScaffold from "@/components/onboarding/KineticOnboardingScaffold";
import TripManagePreview from "@/components/onboarding/TripManagePreview";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";
import { kinetic } from "@/styles/design-system";

export const DRIVER_ONBOARDING_COMPLETED_KEY = "driver_onboarding_completed";

export default function OnboardingOneScreen() {
  const { t } = useTranslation("onboarding");
  const [saving, setSaving] = useState(false);

  const description = useMemo(() => t("oneDescription"), [t]);

  const markCompleteAndContinue = async () => {
    if (saving) return;
    try {
      setSaving(true);
      await AsyncStorage.setItem(DRIVER_ONBOARDING_COMPLETED_KEY, "true");
      router.replace("/(routes)/login");
    } finally {
      setSaving(false);
    }
  };

  const goToNextScreen = () => {
    router.replace("/(routes)/onboarding-two");
  };

  return (
    <KineticOnboardingScaffold
      brandText={t("brand")}
      title={
        <Text style={styles.title}>
          {t("manageTripsTitle")}
          {"\n"}
          <Text style={styles.titleAccent}>{t("manageTripsAccent")}</Text>
        </Text>
      }
      description={description}
      activeStep={0}
      totalSteps={2}
      onSkip={markCompleteAndContinue}
      onNext={goToNextScreen}
      nextLabel={t("next")}
    >
      <TripManagePreview />
    </KineticOnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    color: kinetic.colors.onSurface,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT30,
    lineHeight: 40,
  },
  titleAccent: {
    color: kinetic.colors.primary,
  },
});
