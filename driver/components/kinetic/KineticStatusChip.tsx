import React from "react";
import { StyleSheet, Text, View } from "react-native";
import fonts from "@/themes/app.fonts";
import { kinetic } from "@/styles/design-system";

type KineticStatusChipProps = {
  label: string;
  tone?: "live" | "neutral";
};

export default function KineticStatusChip({
  label,
  tone = "live",
}: KineticStatusChipProps) {
  const isLive = tone === "live";
  return (
    <View style={[styles.chip, isLive ? styles.liveChip : styles.neutralChip]}>
      <View style={[styles.dot, isLive ? styles.liveDot : styles.neutralDot]} />
      <Text style={[styles.label, isLive ? styles.liveLabel : styles.neutralLabel]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveChip: {
    backgroundColor: kinetic.colors.surfaceLowest,
    ...kinetic.shadows.soft,
  },
  neutralChip: {
    backgroundColor: kinetic.colors.surfaceLow,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  liveDot: {
    backgroundColor: kinetic.colors.success,
  },
  neutralDot: {
    backgroundColor: kinetic.colors.outlineVariant,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  liveLabel: {
    color: kinetic.colors.onSurface,
  },
  neutralLabel: {
    color: kinetic.colors.onSurfaceVariant,
  },
});

