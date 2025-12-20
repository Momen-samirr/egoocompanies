import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { spacing, shadows, borderRadius } from "@/styles/design-system";
// Try to import expo-haptics, fallback to Vibration if not available
let Haptics: any = null;
try {
  Haptics = require("expo-haptics");
} catch (e) {
  // expo-haptics not available, will use Vibration as fallback
}

interface OnlineStatusButtonProps {
  isOn: boolean;
  onToggle: () => void;
  loading?: boolean;
  inHeader?: boolean; // When true, reduces top margin for better spacing in header
}

export default function OnlineStatusButton({
  isOn,
  onToggle,
  loading = false,
  inHeader = false,
}: OnlineStatusButtonProps) {
  // Pulse animation for online state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  // Scale animation for press feedback
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when online
  useEffect(() => {
    if (isOn && !loading) {
      // Create pulse animation loop
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.02,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.8,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ])
      );

      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
      };
    } else {
      // Reset animations when offline
      pulseAnim.setValue(1);
      opacityAnim.setValue(1);
    }
  }, [isOn, loading]);

  const handlePress = () => {
    if (loading) return;

    // Haptic feedback
    try {
      if (Haptics) {
        if (Platform.OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } else {
        // Fallback to vibration
        Vibration.vibrate(10);
      }
    } catch (error) {
      // Haptics not available, use vibration as fallback
      try {
        Vibration.vibrate(10);
      } catch (vibError) {
        // Vibration also not available, continue without feedback
      }
    }

    // Scale animation on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onToggle();
  };

  const backgroundColor = isOn ? color.status.online : color.lightGray;
  const textColor = isOn ? color.whiteColor : color.text.secondary;
  const iconColor = isOn ? color.whiteColor : color.text.secondary;
  const subtitleColor = isOn ? "rgba(255, 255, 255, 0.9)" : color.text.tertiary;

  // Combine pulse and scale animations
  const combinedScale = Animated.multiply(pulseAnim, scaleAnim);

  // Adjust margins based on context
  const containerMargins = inHeader
    ? { marginTop: spacing.xs, marginBottom: spacing.md } // Reduced top margin in header
    : { marginVertical: spacing.md }; // Full margins when standalone

  return (
    <Animated.View
      style={[
        styles.container,
        containerMargins,
        {
          backgroundColor,
          transform: [{ scale: combinedScale }],
          opacity: isOn ? opacityAnim : 1,
          borderWidth: isOn ? 0 : 1,
          borderColor: isOn ? "transparent" : color.border,
        },
        isOn && shadows.md,
      ]}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        disabled={loading}
        activeOpacity={0.8}
        accessibilityLabel={isOn ? "Go offline" : "Go online"}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={isOn ? color.whiteColor : color.primary}
              style={styles.loader}
            />
          ) : (
            <Ionicons
              name={isOn ? "checkmark-circle" : "close-circle"}
              size={24}
              color={iconColor}
              style={styles.icon}
            />
          )}

          <View style={styles.textContainer}>
            <Text style={[styles.statusText, { color: textColor }]}>
              {isOn ? "ONLINE" : "OFFLINE"}
            </Text>
            <Text style={[styles.subtitleText, { color: subtitleColor }]}>
              {isOn ? "Available for rides" : "Not available"}
            </Text>
          </View>

          {!loading && (
            <View style={styles.indicatorContainer}>
              <View
                style={[
                  styles.statusIndicator,
                  {
                    backgroundColor: isOn
                      ? color.whiteColor
                      : color.text.secondary,
                  },
                ]}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: windowHeight(64),
    width: "100%",
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  button: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  icon: {
    marginRight: spacing.md,
  },
  loader: {
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  statusText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT18,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subtitleText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.FONT14,
  },
  indicatorContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});





























