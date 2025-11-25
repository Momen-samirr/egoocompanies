import { View, Text, StyleSheet } from "react-native";
import React from "react";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { spacing } from "@/styles/design-system";

interface StatusBadgeProps {
  status: "scheduled" | "active" | "completed" | "cancelled" | "failed" | "forceClosed" | "online" | "offline";
  label?: string;
  size?: "sm" | "md" | "lg";
}

export default function StatusBadge({
  status,
  label,
  size = "md",
}: StatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case "scheduled":
        return color.status.scheduled;
      case "active":
        return color.status.active;
      case "completed":
        return color.status.completed;
      case "cancelled":
        return color.status.cancelled;
      case "failed":
        return color.status.failed;
      case "forceClosed":
        return color.status.forceClosed;
      case "online":
        return color.status.online;
      case "offline":
        return color.status.offline;
      default:
        return color.status.offline;
    }
  };

  const getStatusLabel = () => {
    if (label) return label;
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const statusColor = getStatusColor();
  const backgroundColor = `${statusColor}20`;

  const sizeStyles = {
    sm: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
      fontSize: fontSizes.FONT10,
    },
    md: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      fontSize: fontSizes.FONT12,
    },
    lg: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      fontSize: fontSizes.FONT14,
    },
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor,
          ...sizeStyles[size],
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: statusColor }]} />
      <Text style={[styles.label, { color: statusColor }]}>
        {getStatusLabel()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs / 2,
  },
  label: {
    fontFamily: fonts.medium,
    fontWeight: "600",
  },
});

