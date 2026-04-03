import React from "react";
import { StyleSheet, Text, View } from "react-native";

type KineticStatsTilesProps = {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
};

export default function KineticStatsTiles({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: KineticStatsTilesProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.card, styles.leftCard]}>
        <Text style={styles.leftLabel}>{leftLabel}</Text>
        <Text style={styles.leftValue}>{leftValue}</Text>
      </View>
      <View style={[styles.card, styles.rightCard]}>
        <Text style={styles.rightLabel}>{rightLabel}</Text>
        <Text style={styles.rightValue}>{rightValue}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  leftCard: {
    backgroundColor: "#F3F4F5",
  },
  rightCard: {
    backgroundColor: "rgba(70,72,212,0.08)",
  },
  leftLabel: {
    color: "#60636E",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  leftValue: {
    color: "#191C1D",
    fontSize: 24,
    fontWeight: "800",
  },
  rightLabel: {
    color: "#4648d4",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  rightValue: {
    color: "#4648d4",
    fontSize: 24,
    fontWeight: "800",
  },
});

