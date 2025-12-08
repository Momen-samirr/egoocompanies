import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@react-navigation/native";
import {
  getUserFriendlyErrorMessage,
  getErrorRecoverySuggestion,
} from "@/lib/errorMessages";
import { spacing } from "@/styles/design-system";
import { fontSizes } from "@/themes/app.constant";
import fonts from "@/themes/app.fonts";
import color from "@/themes/app.colors";

interface ErrorMessageProps {
  error: Error | any;
  onRetry?: () => void;
  onDismiss?: () => void;
  context?: {
    screen?: string;
    action?: string;
  };
}

/**
 * ErrorMessage Component
 * Displays user-friendly error messages with recovery suggestions
 */
export default function ErrorMessage({
  error,
  onRetry,
  onDismiss,
  context,
}: ErrorMessageProps) {
  const { colors } = useTheme();
  const message = getUserFriendlyErrorMessage(error, context);
  const suggestion = getErrorRecoverySuggestion(error);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: color.semantic.errorLight,
          borderColor: color.semantic.error,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.message, { color: color.semantic.error }]}>
          {message}
        </Text>
        {suggestion && (
          <Text style={[styles.suggestion, { color: colors.text }]}>
            {suggestion}
          </Text>
        )}
      </View>
      {(onRetry || onDismiss) && (
        <View style={styles.actions}>
          {onRetry && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: color.semantic.error }]}
              onPress={onRetry}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
          )}
          {onDismiss && (
            <TouchableOpacity
              style={[styles.button, styles.dismissButton]}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>
                Dismiss
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: spacing.sm,
  },
  content: {
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  suggestion: {
    fontSize: fontSizes.FONT12,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  dismissButton: {
    backgroundColor: "transparent",
  },
  buttonText: {
    color: "#fff",
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
    fontWeight: "600",
  },
});

