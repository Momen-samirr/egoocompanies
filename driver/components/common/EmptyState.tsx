import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import React from "react";
import { useTheme } from "@react-navigation/native";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { spacing } from "@/styles/design-system";

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = React.memo(function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View 
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${message || ""}`}
    >
      {icon && (
        <View 
          style={styles.iconContainer}
          accessibilityRole="image"
          accessibilityLabel="Empty state icon"
        >
          {icon}
        </View>
      )}
      <Text 
        style={[styles.title, { color: colors.text }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {message && (
        <Text 
          style={[styles.message, { color: color.text.secondary }]}
          accessibilityRole="text"
        >
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: color.primary }]}
          onPress={onAction}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityHint="Tap to perform action"
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.title === nextProps.title &&
    prevProps.message === nextProps.message &&
    prevProps.actionLabel === nextProps.actionLabel
  );
});

export default EmptyState;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes.FONT20,
    fontFamily: fonts.bold,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.regular,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: fontSizes.FONT20,
  },
  actionButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  actionButtonText: {
    color: color.whiteColor,
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.medium,
    fontWeight: "600",
  },
});

