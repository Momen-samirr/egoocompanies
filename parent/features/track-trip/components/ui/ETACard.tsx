/**
 * ETA display card component
 */

import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { ETA } from "../../types";

/**
 * Props for ETACard component
 */
export interface ETACardProps {
  eta: ETA | null;
  calculating?: boolean;
  error?: boolean;
}

/**
 * ETA card component displaying estimated arrival time and distance
 */
export function ETACard({ eta, calculating = false, error = false }: ETACardProps) {
  if (error && !eta) {
    return (
      <View style={styles.etaCard}>
        <Text style={styles.errorText}>Unable to calculate ETA</Text>
      </View>
    );
  }

  if (calculating && !eta) {
    return (
      <View style={styles.etaCard}>
        <ActivityIndicator size="small" color="#6366f1" />
        <Text style={styles.etaLabel}>Calculating...</Text>
      </View>
    );
  }

  if (!eta) {
    return null;
  }

  return (
    <View style={styles.etaCard}>
      <Text style={styles.etaLabel}>Estimated Arrival</Text>
      <Text style={styles.etaValue}>{Math.round(eta.minutes)} min</Text>
      <Text style={styles.etaDistance}>
        {Math.round((eta.distanceMeters / 1000) * 10) / 10} km away
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  etaCard: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "rgba(225,224,255,0.45)",
    marginHorizontal: 14,
    marginVertical: 10,
    borderRadius: 20,
  },
  etaLabel: {
    fontSize: 13,
    color: "#60636E",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  etaValue: {
    fontSize: 44,
    fontWeight: "bold",
    color: "#494BD6",
  },
  etaDistance: {
    fontSize: 14,
    color: "#60636E",
    marginTop: 5,
  },
  errorText: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
  },
});

