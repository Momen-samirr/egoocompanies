import React, { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import EarningsPreviewCard from "@/components/onboarding/EarningsPreviewCard";
import KineticPrimaryButton from "@/components/kinetic/KineticPrimaryButton";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";
import { kinetic, spacing } from "@/styles/design-system";
import { DRIVER_ONBOARDING_COMPLETED_KEY } from "@/screens/onboarding/onboarding-one.screen";

export default function OnboardingTwoScreen() {
  const { t } = useTranslation("onboarding");
  const [saving, setSaving] = useState(false);

  const completeOnboarding = async () => {
    if (saving) return;
    try {
      setSaving(true);
      await AsyncStorage.setItem(DRIVER_ONBOARDING_COMPLETED_KEY, "true");
      router.replace("/(routes)/login");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.leftHeader}>
          <TouchableOpacity
            onPress={() => router.replace("/(routes)/onboarding")}
            activeOpacity={0.75}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color="#667085" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("createAccountHeader")}</Text>
        </View>
        <TouchableOpacity onPress={completeOnboarding} activeOpacity={0.75}>
          <Text style={styles.skipText}>{t("skip")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <EarningsPreviewCard />

        <View style={styles.copyWrap}>
          <Text style={styles.title}>{t("startEarningTitle")}</Text>
          <Text style={styles.subtitle}>{t("startEarningSubtitle")}</Text>
        </View>

        <View style={styles.pagination}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
        </View>
      </View>

      <View style={styles.footer}>
        <KineticPrimaryButton
          title={saving ? t("loading") : t("getStarted")}
          onPress={completeOnboarding}
          loading={saving}
          icon={<Ionicons name="arrow-forward" size={20} color={kinetic.colors.onPrimary} />}
          height={68}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kinetic.colors.surface,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#0D1117",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT30,
  },
  skipText: {
    color: kinetic.colors.primary,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT18,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    alignItems: "center",
  },
  copyWrap: {
    alignItems: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  title: {
    color: kinetic.colors.onSurface,
    fontFamily: fonts.bold,
    fontSize: 48,
    lineHeight: 54,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  subtitle: {
    color: kinetic.colors.onSurfaceVariant,
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT18,
    lineHeight: 34,
    textAlign: "center",
    maxWidth: 340,
  },
  pagination: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(199,196,215,0.8)",
  },
  activeDot: {
    width: 34,
    backgroundColor: kinetic.colors.primary,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
});
