import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import { fontSizes } from "@/themes/app.constant";
import { useGetDriverData } from "@/hooks/useGetDriverData";
import Input from "@/components/common/input";
import SelectInput from "@/components/common/select-input";
import { countryNameItems } from "@/configs/country-name-list";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import AuthShell from "@/components/auth/AuthShell";
import AuthBrandHeader from "@/components/auth/AuthBrandHeader";
import AuthCard from "@/components/auth/AuthCard";
import fonts from "@/themes/app.fonts";
import KineticPrimaryButton from "@/components/kinetic/KineticPrimaryButton";
import { kinetic, spacing } from "@/styles/design-system";

export default function Profile() {
  const { t } = useTranslation("profile");
  const { driver, loading } = useGetDriverData();
  const totalTrips =
    (driver as any)?.totalTrips ??
    (driver as any)?.tripsCompleted ??
    (driver as any)?.completedTrips ??
    0;
  const rating = (driver as any)?.rating ?? "--";
  const earnings =
    (driver as any)?.totalEarnings ??
    (driver as any)?.earnings ??
    (driver as any)?.walletBalance ??
    "--";

  if (loading) {
    return null;
  }

  return (
    <AuthShell>
      <AuthBrandHeader title={t("title")} subtitle={t("subtitle")} />
      <AuthCard>
        <Text style={styles.sectionTitle}>
          {driver?.name || t("guestDriver")}
        </Text>
        <View style={styles.ratingChip}>
          <Text style={styles.ratingValue}>{String(rating)}</Text>
          <Text style={styles.ratingLabel}>{t("platinumDriver")}</Text>
        </View>

        <View style={styles.performanceRow}>
          <View style={[styles.performanceCard, styles.performancePrimary]}>
            <Text style={styles.performanceLabel}>{t("totalTrips")}</Text>
            <Text style={styles.performanceValue}>{String(totalTrips)}</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>{t("rating")}</Text>
            <Text style={styles.performanceValue}>{String(rating)}</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>{t("earnings")}</Text>
            <Text style={styles.performanceValue}>
              {typeof earnings === "number" ? `${earnings} BDT` : String(earnings)}
            </Text>
          </View>
        </View>
        <View style={styles.activitySection}>
          <Text style={styles.activityTitle}>{t("recentActivity")}</Text>
          <View style={styles.activityItem}>
            <Text style={styles.activityText}>
              {t("tripLabel", { id: (driver as any)?.lastTripId || "TH-9421" })}
            </Text>
            <Text style={styles.activityBadge}>{t("completed")}</Text>
          </View>
          <View style={styles.activityItem}>
            <Text style={styles.activityText}>
              {t("tripLabel", { id: (driver as any)?.lastTripIdTwo || "TH-9418" })}
            </Text>
            <Text style={[styles.activityBadge, styles.cancelledBadge]}>{t("cancelled")}</Text>
          </View>
        </View>
        <View style={styles.menuSection}>
          <View style={styles.menuRow}>
            <Text style={styles.menuLabel}>{t("documentStatus")}</Text>
            <Text style={styles.menuValue}>{t("approved")}</Text>
          </View>
          <View style={styles.menuRow}>
            <Text style={styles.menuLabel}>{t("payoutSettings")}</Text>
            <Text style={styles.menuValue}>{t("payoutConfigured")}</Text>
          </View>
          <View style={styles.menuRow}>
            <Text style={styles.menuLabel}>{t("helpCenter")}</Text>
            <Text style={styles.menuValue}>{t("helpOpen")}</Text>
          </View>
        </View>
        <View style={styles.fieldsWrap}>
          <Input
            title={t("fieldName")}
            value={driver?.name}
            onChangeText={() => console.log("")}
            placeholder={driver?.name!}
          />
          <Input
            title={t("fieldEmail")}
            value={driver?.email}
            onChangeText={() => console.log("")}
            placeholder={driver?.email!}
            disabled={true}
          />
          <Input
            title={t("fieldPhone")}
            value={driver?.phone_number}
            onChangeText={() => console.log("")}
            placeholder={driver?.phone_number!}
            disabled={true}
          />
          <SelectInput
            value={driver?.country}
            onValueChange={() => console.log("")}
            title={t("fieldCountry")}
            placeholder={t("countryPlaceholder")}
            items={countryNameItems}
          />
          <View style={styles.logoutWrap}>
            <KineticPrimaryButton
              onPress={async () => {
                await AsyncStorage.removeItem("accessToken");
                router.push("/(routes)/login");
              }}
              title={t("logout")}
            />
          </View>
        </View>
      </AuthCard>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT28,
    color: "#191C1D",
    marginBottom: 8,
  },
  ratingChip: {
    alignSelf: "flex-start",
    backgroundColor: kinetic.colors.surfaceLow,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  ratingValue: {
    fontFamily: fonts.bold,
    color: kinetic.colors.onSurface,
    fontSize: fontSizes.FONT14,
  },
  ratingLabel: {
    fontFamily: fonts.medium,
    color: kinetic.colors.onSurfaceVariant,
    fontSize: fontSizes.FONT12,
  },
  performanceRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  performanceCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(199,196,215,0.35)",
  },
  performancePrimary: {
    backgroundColor: "#E1E0FF",
    borderColor: "rgba(96,99,238,0.3)",
  },
  performanceLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#6B6E78",
    marginBottom: 4,
  },
  performanceValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#191C1D",
  },
  fieldsWrap: {
    gap: 6,
  },
  activitySection: {
    marginBottom: 16,
  },
  activityTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: "#191C1D",
    marginBottom: 8,
  },
  activityItem: {
    backgroundColor: "#F3F4F5",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activityText: {
    fontFamily: fonts.medium,
    color: "#191C1D",
  },
  activityBadge: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#10b981",
    backgroundColor: "rgba(16,185,129,0.12)",
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelledBadge: {
    color: "#ba1a1a",
    backgroundColor: "#ffdad6",
  },
  menuSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(199,196,215,0.25)",
  },
  menuRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  menuLabel: {
    fontFamily: fonts.medium,
    color: "#191C1D",
  },
  menuValue: {
    fontFamily: fonts.medium,
    color: "#60636E",
  },
  logoutWrap: {
    marginTop: 18,
    marginBottom: spacing.xs,
  },
});
