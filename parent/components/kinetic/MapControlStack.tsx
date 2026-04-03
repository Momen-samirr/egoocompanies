import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type MapControlStackProps = {
  onCenterPress?: () => void;
  onCompassPress?: () => void;
};

export default function MapControlStack({
  onCenterPress,
  onCompassPress,
}: MapControlStackProps) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.button} onPress={onCenterPress} activeOpacity={0.9}>
        <Ionicons name="locate" size={20} color="#464554" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={onCompassPress} activeOpacity={0.9}>
        <Ionicons name="navigate" size={20} color="#464554" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 16,
    bottom: 300,
    gap: 10,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4648d4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
});

