/**
 * Connection status indicator component
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Props for ConnectionStatus component
 */
export interface ConnectionStatusProps {
  connected: boolean;
  error?: string | null;
  showDirectionsError?: boolean;
}

/**
 * Connection status indicator component
 */
export function ConnectionStatus({
  connected,
  error,
  showDirectionsError = false,
}: ConnectionStatusProps) {
  const getStatusText = () => {
    if (connected) {
      return "Live Tracking";
    }
    if (error) {
      return "Connection Error";
    }
    return "Connecting...";
  };

  const getStatusColor = () => {
    if (connected) {
      return "#10b981"; // Green
    }
    return "#ef4444"; // Red
  };

  return (
    <View style={styles.statusBar}>
      <View
        style={[
          styles.statusIndicator,
          { backgroundColor: getStatusColor() },
        ]}
      />
      <Text style={styles.statusText}>{getStatusText()}</Text>
      {showDirectionsError && (
        <View style={styles.warningBadge}>
          <Ionicons name="warning" size={12} color="#f59e0b" />
          <Text style={styles.warningText}>Using simplified route</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    backgroundColor: "#FFF4D8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  warningText: {
    fontSize: 11,
    color: "#f59e0b",
    marginLeft: 4,
  },
});

