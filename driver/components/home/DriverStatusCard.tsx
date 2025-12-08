import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Vibration,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  interpolateColor,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@react-navigation/native";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import {
  spacing,
  shadows,
  borderRadius,
  animation,
} from "@/styles/design-system";
import { Correct } from "@/utils/icons";
import { Close } from "@/assets/icons/close";

interface DriverStatusCardProps {
  isOnline: boolean;
  isLoading: boolean;
  onToggle: () => void;
  wsConnected?: boolean;
  showConnectionStatus?: boolean;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function DriverStatusCard({
  isOnline,
  isLoading,
  onToggle,
  wsConnected = true,
  showConnectionStatus = true,
}: DriverStatusCardProps) {
  const { colors } = useTheme();

  // Animation values
  const backgroundColor = useSharedValue(isOnline ? 1 : 0);
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Update background color when status changes
  useEffect(() => {
    backgroundColor.value = withTiming(isOnline ? 1 : 0, {
      duration: animation.normal,
      easing: Easing.out(Easing.ease),
    });
  }, [isOnline]);

  // Pulse animation when online
  useEffect(() => {
    if (isOnline && !isLoading) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: animation.fast });
    }
  }, [isOnline, isLoading]);

  // Button press animation
  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: animation.fast });
    // Haptic feedback
    if (Platform.OS === "ios") {
      // Use Haptics API if available (expo-haptics)
      // For now, use vibration as fallback
      Vibration.vibrate(10);
    } else {
      Vibration.vibrate(10);
    }
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: animation.fast });
  };

  // Animated styles
  const cardAnimatedStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      backgroundColor.value,
      [0, 1],
      [color.status.offline, color.status.online]
    );

    return {
      backgroundColor: bgColor,
      transform: [{ scale: pulseScale.value }],
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isLoading ? 0.6 : 1, { duration: animation.fast }),
    };
  });

  const statusText = isOnline ? "You're Online" : "You're Offline";
  const buttonText = isOnline ? "Go Offline" : "Go Online";
  const statusSubtext = isOnline
    ? "Available for rides"
    : "Tap to start receiving ride requests";

  return (
    <Animated.View style={[styles.container, cardAnimatedStyle, shadows.md]}>
      <View style={styles.content}>
        {/* Status Section */}
        <View style={styles.statusSection}>
          <Animated.View style={[styles.statusIndicator, textAnimatedStyle]}>
            <View
              style={[
                styles.indicatorDot,
                {
                  backgroundColor: isOnline
                    ? color.whiteColor
                    : color.status.offline,
                },
              ]}
            />
            <Animated.Text
              style={[
                styles.statusText,
                { color: color.whiteColor },
                textAnimatedStyle,
              ]}
            >
              {statusText}
            </Animated.Text>
          </Animated.View>

          {showConnectionStatus && (
            <View style={styles.connectionStatus}>
              <View
                style={[
                  styles.connectionDot,
                  {
                    backgroundColor: wsConnected
                      ? color.semantic.success
                      : color.semantic.error,
                  },
                ]}
              />
              <Text
                style={[styles.connectionText, { color: color.whiteColor }]}
              >
                {wsConnected ? "Connected" : "Disconnected"}
              </Text>
            </View>
          )}

          <Animated.Text
            style={[
              styles.subtext,
              { color: color.whiteColor },
              textAnimatedStyle,
            ]}
          >
            {statusSubtext}
          </Animated.Text>
        </View>

        {/* Toggle Button */}
        <AnimatedTouchable
          style={[styles.toggleButton, buttonAnimatedStyle]}
          onPress={onToggle}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isLoading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={buttonText}
          accessibilityState={{ disabled: isLoading }}
          accessibilityHint={
            isOnline
              ? "Double tap to go offline and stop receiving ride requests"
              : "Double tap to go online and start receiving ride requests"
          }
        >
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={color.whiteColor}
              style={styles.loader}
            />
          ) : (
            <View style={styles.buttonContent}>
              {isOnline ? (
                <View style={styles.iconContainer}>
                  <Close />
                </View>
              ) : (
                <View style={styles.iconContainer}>
                  <Correct />
                </View>
              )}
              <Text style={styles.buttonText}>{buttonText}</Text>
            </View>
          )}
        </AnimatedTouchable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    minHeight: windowHeight(100),
  },
  content: {
    padding: spacing.lg,
  },
  statusSection: {
    marginBottom: spacing.md,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  indicatorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: color.whiteColor,
  },
  statusText: {
    fontSize: fontSizes.FONT20,
    fontFamily: fonts.bold,
    fontWeight: "700",
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  connectionText: {
    fontSize: fontSizes.FONT12,
    fontFamily: fonts.regular,
    opacity: 0.9,
  },
  subtext: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.regular,
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  toggleButton: {
    backgroundColor: color.whiteColor,
    borderRadius: borderRadius.md,
    height: windowHeight(56),
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.md,
    minHeight: 44, // Accessibility minimum
    ...shadows.sm,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonText: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.bold,
    color: color.primary,
    fontWeight: "600",
  },
  loader: {
    marginVertical: spacing.sm,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
