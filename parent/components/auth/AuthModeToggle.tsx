import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type AuthModeToggleProps = {
  usePhone: boolean;
  onChange: (usePhone: boolean) => void;
};

export default function AuthModeToggle({ usePhone, onChange }: AuthModeToggleProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.tab, usePhone && styles.tabActive]}
        onPress={() => onChange(true)}
      >
        <Text style={[styles.tabText, usePhone && styles.tabTextActive]}>Phone</Text>
      </Pressable>
      <Pressable
        style={[styles.tab, !usePhone && styles.tabActive]}
        onPress={() => onChange(false)}
      >
        <Text style={[styles.tabText, !usePhone && styles.tabTextActive]}>Email</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#ECEEF4",
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    height: 46,
  },
  tabActive: {
    backgroundColor: "#494BD6",
  },
  tabText: {
    fontSize: 14,
    color: "#6A6D77",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
});
