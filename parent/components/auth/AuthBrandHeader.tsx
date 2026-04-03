import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type AuthBrandHeaderProps = {
  title?: string;
  subtitle?: string;
};

export default function AuthBrandHeader({
  title = "Transport Hub",
  subtitle = "Safe. Reliable. Editorial Trust.",
}: AuthBrandHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="navigate" size={28} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 28,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#494BD6",
    marginBottom: 16,
    shadowColor: "#494BD6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#494BD6",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#666777",
    textAlign: "center",
  },
});
