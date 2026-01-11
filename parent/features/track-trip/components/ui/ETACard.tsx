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
    backgroundColor: "#f0f9ff",
    margin: 15,
    borderRadius: 12,
  },
  etaLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 5,
  },
  etaValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#6366f1",
  },
  etaDistance: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 5,
  },
  errorText: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
  },
});

