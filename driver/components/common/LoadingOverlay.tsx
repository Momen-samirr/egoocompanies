import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useTheme } from "@react-navigation/native";
import { spacing } from "@/styles/design-system";
import { fontSizes } from "@/themes/app.constant";
import fonts from "@/themes/app.fonts";
import color from "@/themes/app.colors";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  fullScreen?: boolean;
}

/**
 * LoadingOverlay Component
 * Displays a loading overlay with spinner and optional message
 */
export default function LoadingOverlay({
  visible,
  message,
  fullScreen = false,
}: LoadingOverlayProps) {
  const { colors } = useTheme();

  if (!visible) {
    return null;
  }

  return (
    <View
      style={[
        styles.overlay,
        fullScreen && styles.fullScreen,
        { backgroundColor: fullScreen ? colors.background : "rgba(0, 0, 0, 0.5)" },
      ]}
    >
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="large" color={color.primary} />
        {message && (
          <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
  },
  fullScreen: {
    backgroundColor: "#fff",
  },
  container: {
    padding: spacing.xl,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 120,
    ...color.shadows?.md || {},
  },
  message: {
    marginTop: spacing.md,
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
    textAlign: "center",
  },
});

