import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import fonts from "@/themes/app.fonts";
import { kinetic } from "@/styles/design-system";

type KineticTopBarProps = {
  title: string;
  onLeftPress?: () => void;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightNode?: React.ReactNode;
  avatarUrl?: string;
};

export default function KineticTopBar({
  title,
  onLeftPress,
  leftIcon = "menu",
  rightNode,
  avatarUrl,
}: KineticTopBarProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.leftRow}>
          <TouchableOpacity
            onPress={onLeftPress}
            activeOpacity={0.8}
            style={styles.iconButton}
          >
            <Ionicons name={leftIcon} size={20} color={kinetic.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.rightRow}>
          {rightNode}
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={16} color={kinetic.colors.primary} />
            </View>
          )}
        </View>
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: kinetic.colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(237,238,239,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: kinetic.colors.onSurface,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(96,99,238,0.3)",
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: kinetic.colors.surfaceLowest,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(199,196,215,0.25)",
  },
});

