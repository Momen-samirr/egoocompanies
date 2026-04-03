import React from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import fonts from "@/themes/app.fonts";
import { kinetic } from "@/styles/design-system";

type KineticPrimaryButtonProps = {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  height?: number;
};

const hasNativeLinearGradient = (() => {
  if (Platform.OS === "web") return true;

  try {
    const getConfig = UIManager.getViewManagerConfig?.bind(UIManager);
    if (!getConfig) return false;

    return Boolean(
      getConfig("ViewManagerAdapter_ExpoLinearGradient") ||
        getConfig("ExpoLinearGradient")
    );
  } catch {
    return false;
  }
})();

export default function KineticPrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  height = 56,
}: KineticPrimaryButtonProps) {
  const buttonContent = loading ? (
    <ActivityIndicator color={kinetic.colors.onPrimary} />
  ) : (
    <View style={styles.content}>
      <Text style={styles.title}>{title}</Text>
      {icon}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.wrap,
        { height, opacity: disabled || loading ? 0.6 : 1 },
        pressed && styles.pressed,
      ]}
    >
      {hasNativeLinearGradient ? (
        <LinearGradient
          colors={[kinetic.colors.primary, kinetic.colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {buttonContent}
        </LinearGradient>
      ) : (
        <View style={[styles.gradient, styles.solidFallback]}>{buttonContent}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: kinetic.radius.xl,
    overflow: "hidden",
  },
  gradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  solidFallback: {
    backgroundColor: kinetic.colors.primary,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: kinetic.colors.onPrimary,
    fontSize: 17,
    fontFamily: fonts.bold,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});

