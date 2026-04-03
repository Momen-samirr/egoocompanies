import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { kinetic, spacing } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";
import { useLanguageSelection } from "@/hooks/useLanguageSelection";

export default function LanguageSelectionScreen() {
  const { t } = useTranslation("common");
  const { busy, error, selectLanguage } = useLanguageSelection();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      bounces={false}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>{t("languageTitle")}</Text>
        <Text style={styles.subtitle}>{t("languageSubtitle")}</Text>

        <View style={styles.options}>
          <TouchableOpacity
            style={styles.option}
            onPress={() => selectLanguage("en")}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("english")}
            accessibilityState={{ busy }}
          >
            <Text style={styles.optionText}>{t("english")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, styles.optionArabic]}
            onPress={() => selectLanguage("ar")}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("arabicLabel")}
            accessibilityState={{ busy }}
          >
            <Text style={[styles.optionText, styles.arabicFont]}>
              {t("arabicLabel")}
            </Text>
          </TouchableOpacity>
        </View>

        {busy ? (
          <ActivityIndicator
            style={styles.spinner}
            color={kinetic.colors.primary}
            size="large"
            accessibilityLabel={t("loading")}
          />
        ) : null}

        {error ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: kinetic.colors.surface,
    paddingHorizontal: spacing.xl,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    minHeight: 400,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT28,
    color: kinetic.colors.onSurface,
    marginBottom: spacing.sm,
    textAlign: "center",
    writingDirection: "auto",
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.FONT14,
    color: kinetic.colors.onSurfaceVariant,
    marginBottom: spacing.xxl,
    textAlign: "center",
    lineHeight: 22,
    writingDirection: "auto",
  },
  options: {
    gap: spacing.md,
  },
  option: {
    borderRadius: 20,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: kinetic.colors.surfaceLowest,
    borderWidth: 1,
    borderColor: "rgba(199,196,215,0.45)",
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
  },
  optionArabic: {
    backgroundColor: "rgba(70,72,212,0.08)",
    borderColor: kinetic.colors.primary,
  },
  optionText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT18,
    color: kinetic.colors.onSurface,
    textAlign: "center",
    writingDirection: "auto",
  },
  arabicFont: {
    fontSize: fontSizes.FONT22,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  errorText: {
    marginTop: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: fontSizes.FONT14,
    color: kinetic.colors.error,
    textAlign: "center",
  },
});
