/**
 * Route point marker component
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { TripPoint, Coordinate } from "../../types";

/**
 * Props for RouteMarker component
 */
export interface RouteMarkerProps {
  point: TripPoint;
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isStudentPoint: boolean;
  isStartPoint: boolean;
}

/**
 * Route point marker component
 */
export function RouteMarker({
  point,
  index,
  isCompleted,
  isCurrent,
  isStudentPoint,
  isStartPoint,
}: RouteMarkerProps) {
  if (!point.latitude || !point.longitude || !point.id) {
    return null;
  }

  const coordinate: Coordinate = {
    latitude: point.latitude,
    longitude: point.longitude,
  };

  return (
    <Marker
      key={`point-${point.id}`}
      coordinate={coordinate}
      title={point.name}
      description={isStudentPoint ? "Your pickup point" : `Stop ${index + 1}`}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <View
        style={[
          styles.pointMarker,
          isStudentPoint && styles.studentPointMarker,
          isStartPoint && !isStudentPoint && styles.startPointMarker,
          isCompleted && styles.completedPointMarker,
          isCurrent && styles.currentPointMarker,
        ]}
      >
        {isStudentPoint ? (
          <Ionicons name="location" size={28} color="#494BD6" />
        ) : isStartPoint ? (
          <Ionicons name="play-circle" size={24} color="#10b981" />
        ) : (
          <Ionicons name="ellipse" size={20} color="#60636E" />
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pointMarker: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 8,
    borderWidth: 0,
    shadowColor: "#494BD6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  studentPointMarker: {
    borderColor: "#494BD6",
    borderWidth: 2,
  },
  startPointMarker: {
    borderColor: "#10b981",
  },
  completedPointMarker: {
    borderColor: "#9ca3af",
    opacity: 0.7,
  },
  currentPointMarker: {
    borderColor: "#494BD6",
    borderWidth: 2,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
});
