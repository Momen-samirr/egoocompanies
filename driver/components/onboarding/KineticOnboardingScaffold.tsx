import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";
import { kinetic, spacing } from "@/styles/design-system";
import KineticPrimaryButton from "@/components/kinetic/KineticPrimaryButton";

interface KineticOnboardingScaffoldProps {
  brandText: string;
  title: React.ReactNode;
  description: string;
  activeStep: number;
  totalSteps: number;
  nextLabel?: string;
  onSkip: () => void;
  onNext: () => void;
  children: React.ReactNode;
}

export default function KineticOnboardingScaffold({
  brandText,
  title,
  description,
  activeStep,
  totalSteps,
  nextLabel,
  onSkip,
  onNext,
  children,
}: KineticOnboardingScaffoldProps) {
  const { t } = useTranslation("onboarding");
  const resolvedNextLabel = nextLabel ?? t("next");
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.brand}>{brandText}</Text>
        <TouchableOpacity onPress={onSkip} activeOpacity={0.75} style={styles.skipButton}>
          <Text style={styles.skipText}>{t("skip")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {children}
        <View style={styles.copyBlock}>
          {title}
          <Text style={styles.description}>{description}</Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxl),
          },
        ]}
      >
        <View style={styles.pagination}>
          {Array.from({ length: totalSteps }).map((_, index) => {
            const isActive = index === activeStep;
            return <View key={index} style={[styles.dot, isActive && styles.activeDot]} />;
          })}
        </View>
        <KineticPrimaryButton
          title={resolvedNextLabel}
          onPress={onNext}
          icon={<Ionicons name="arrow-forward" size={18} color={kinetic.colors.onPrimary} />}
          height={58}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kinetic.colors.surface,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: "#0D1117",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT30,
    letterSpacing: 0.2,
  },
  skipButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  skipText: {
    color: "#7A8294",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT16,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: 170,
  },
  copyBlock: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  description: {
    color: "#2B3341",
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT16,
    lineHeight: 30,
    maxWidth: "95%",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...kinetic.shadows.ambient,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(199,196,215,0.45)",
  },
  activeDot: {
    width: 32,
    backgroundColor: kinetic.colors.primary,
  },
});
