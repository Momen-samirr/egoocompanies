import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type KineticDriverCardProps = {
  name: string;
  vehicleText: string;
  avatarUrl?: string;
  onCall?: () => void;
};

export default function KineticDriverCard({
  name,
  vehicleText,
  avatarUrl,
  onCall,
}: KineticDriverCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Ionicons name="person" size={20} color="#4648d4" />
          </View>
        )}
        <View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.vehicle}>{vehicleText}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.callBtn} onPress={onCall} activeOpacity={0.9}>
        <Ionicons name="call" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#E1E0FF",
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#191C1D",
  },
  vehicle: {
    fontSize: 13,
    color: "#60636E",
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#4648d4",
    justifyContent: "center",
    alignItems: "center",
  },
});

