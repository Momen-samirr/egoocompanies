import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";
import { kinetic, spacing } from "@/styles/design-system";

export default function EarningsPreviewCard() {
  return (
    <View style={styles.heroWrap}>
      <View style={styles.glow} />

      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.walletIconWrap}>
            <Ionicons name="wallet" size={24} color={kinetic.colors.primary} />
          </View>
          <View style={styles.growthPill}>
            <Ionicons name="trending-up" size={12} color="#047857" />
            <Text style={styles.growthText}>+24%</Text>
          </View>
        </View>

        <View>
          <Text style={styles.balanceLabel}>Daily Balance</Text>
          <Text style={styles.balanceValue}>$428.50</Text>
        </View>

        <View style={styles.chartRow}>
          <View style={[styles.bar, styles.barOne]} />
          <View style={[styles.bar, styles.barTwo]} />
          <View style={[styles.bar, styles.barThree]} />
          <View style={[styles.bar, styles.barFour]} />
          <View style={[styles.bar, styles.barFive]} />
          <View style={[styles.bar, styles.barSix]} />
        </View>
      </View>

      <View style={styles.floatingBadge}>
        <Ionicons name="cash-outline" size={16} color={kinetic.colors.primary} />
        <View>
          <Text style={styles.badgeSmall}>INCENTIVE</Text>
          <Text style={styles.badgeText}>Earn 2x on weekends</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(70,72,212,0.08)",
  },
  card: {
    width: "86%",
    maxWidth: 320,
    minHeight: 305,
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(199,196,215,0.25)",
    padding: spacing.xxl,
    justifyContent: "space-between",
    ...kinetic.shadows.ambient,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  walletIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(70,72,212,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  growthPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.14)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  growthText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT14,
    color: "#047857",
  },
  balanceLabel: {
    color: kinetic.colors.onSurfaceVariant,
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT16,
    marginBottom: spacing.xs,
  },
  balanceValue: {
    color: kinetic.colors.onSurface,
    fontFamily: fonts.bold,
    fontSize: 44,
    letterSpacing: 0.4,
  },
  chartRow: {
    height: 110,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: "rgba(70,72,212,0.25)",
  },
  barOne: { height: "42%" },
  barTwo: { height: "56%" },
  barThree: { height: "47%", backgroundColor: "rgba(70,72,212,0.45)" },
  barFour: { height: "72%", backgroundColor: "rgba(70,72,212,0.65)" },
  barFive: { height: "62%", backgroundColor: "rgba(70,72,212,0.38)" },
  barSix: {
    height: "96%",
    backgroundColor: kinetic.colors.primary,
    shadowColor: kinetic.colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  floatingBadge: {
    position: "absolute",
    right: 10,
    bottom: 58,
    borderRadius: 18,
    backgroundColor: "#BDBEFE",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    transform: [{ rotate: "6deg" }],
    ...kinetic.shadows.soft,
  },
  badgeSmall: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT10,
    color: "#4E5078",
    letterSpacing: 0.7,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT16,
    color: "#3A3D63",
  },
});
