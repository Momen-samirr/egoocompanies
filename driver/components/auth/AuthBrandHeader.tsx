import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";

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
        <Ionicons name="navigate" size={28} color={color.whiteColor} />
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
    backgroundColor: color.primary,
    marginBottom: 16,
    shadowColor: color.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontFamily: fonts.bold,
    color: color.primary,
    fontSize: 36,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.regular,
    color: "#666777",
    fontSize: 14,
    textAlign: "center",
  },
});
