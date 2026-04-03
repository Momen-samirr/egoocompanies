/**
 * Trip information card component
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Trip, TripPoint } from "../../types";
import KineticStatsTiles from "@/components/kinetic/KineticStatsTiles";
import KineticTimeline from "@/components/kinetic/KineticTimeline";

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
  const timelineItems = trip.points.slice(0, 3).map((point, index) => ({
    id: point.id,
    label: point.name,
    subtitle: index === currentPointIndex ? "Current checkpoint" : undefined,
    state: index < currentPointIndex ? ("done" as const) : index === currentPointIndex ? ("current" as const) : ("upcoming" as const),
  }));

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
          <KineticStatsTiles
            leftLabel="Status"
            leftValue={`Stop ${currentPointIndex + 1}/${totalPoints}`}
            rightLabel="Estimated ETA"
            rightValue={`${Math.max(totalPoints - currentPointIndex, 1)} mins`}
          />
          <View style={styles.progressBar}>
            <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
          </View>
          <KineticTimeline items={timelineItems} />
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
    padding: 16,
    marginHorizontal: 14,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
  },
  tripName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#191C1D",
    marginBottom: 8,
  },
  pickupInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  pickupPoint: {
    fontSize: 13,
    color: "#60636E",
    marginLeft: 4,
  },
  progressContainer: {
    marginTop: 12,
    gap: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#ECEEF4",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#494BD6",
    borderRadius: 3,
  },
  infoMessage: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F3F4F5",
    borderRadius: 12,
  },
  infoText: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 8,
  },
});

