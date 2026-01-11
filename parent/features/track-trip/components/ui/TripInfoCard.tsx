/**
 * Trip information card component
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Trip, TripPoint } from "../../types";

/**
 * Props for TripInfoCard component
 */
export interface TripInfoCardProps {
  trip: Trip;
  studentPoint: TripPoint | null;
  currentPointIndex: number;
  totalPoints: number;
  showMissingLocationWarning?: boolean;
}

/**
 * Trip information card with trip name, pickup point, and progress
 */
export function TripInfoCard({
  trip,
  studentPoint,
  currentPointIndex,
  totalPoints,
  showMissingLocationWarning = false,
}: TripInfoCardProps) {
  const progressPercentage =
    totalPoints > 0 ? ((currentPointIndex + 1) / totalPoints) * 100 : 0;

  return (
    <View style={styles.tripInfoCard}>
      <Text style={styles.tripName}>{trip.name}</Text>
      
      {studentPoint && (
        <View style={styles.pickupInfo}>
          <Ionicons name="location" size={16} color="#6366f1" />
          <Text style={styles.pickupPoint}>Pickup: {studentPoint.name}</Text>
        </View>
      )}

      {trip.progress && totalPoints > 0 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Stop {currentPointIndex + 1} of {totalPoints}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercentage}%` },
              ]}
            />
          </View>
        </View>
      )}

      {showMissingLocationWarning && (
        <View style={styles.infoMessage}>
          <Ionicons name="information-circle" size={16} color="#6b7280" />
          <Text style={styles.infoText}>
            Waiting for driver location update...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tripInfoCard: {
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tripName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  pickupInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  pickupPoint: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 4,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressText: {
    fontSize: 14,
    color: "#6366f1",
    fontWeight: "500",
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#6366f1",
    borderRadius: 3,
  },
  infoMessage: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 8,
  },
});

