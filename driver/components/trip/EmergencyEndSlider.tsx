import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Animated,
  PanResponder,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { windowWidth, fontSizes } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import { spacing, shadows } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";

interface EmergencyEndSliderProps {
  onConfirm: () => Promise<void>;
  disabled?: boolean;
  disabledMessage?: string;
}

const SLIDER_WIDTH = windowWidth(320);
const THUMB_SIZE = 56;
const TRACK_HEIGHT = 60;
const MAX_SLIDE_DISTANCE = SLIDER_WIDTH - THUMB_SIZE - spacing.md * 2;

export default function EmergencyEndSlider({
  onConfirm,
  disabled = false,
  disabledMessage = "You have already used the emergency end option today.",
}: EmergencyEndSliderProps) {
  const [isSliding, setIsSliding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !isProcessing,
      onMoveShouldSetPanResponder: () => !disabled && !isProcessing,
      onPanResponderGrant: () => {
        setIsSliding(true);
      },
      onPanResponderMove: (_, gestureState) => {
        if (disabled || isProcessing) return;
        
        const newValue = Math.max(
          0,
          Math.min(gestureState.dx, MAX_SLIDE_DISTANCE)
        );
        slideAnim.setValue(newValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (disabled || isProcessing) {
          setIsSliding(false);
          return;
        }

        const slideDistance = gestureState.dx;
        const slideVelocity = gestureState.vx;

        // If slid more than 80% of the way or with sufficient velocity, confirm
        if (slideDistance > MAX_SLIDE_DISTANCE * 0.8 || slideVelocity > 0.5) {
          handleConfirm();
        } else {
          // Snap back
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
          setIsSliding(false);
        }
      },
    })
  ).current;

  const handleConfirm = async () => {
    Alert.alert(
      "Emergency End Trip",
      "Are you sure you want to emergency end this trip? This action cannot be undone and you can only use this option once per day.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: false,
              tension: 50,
              friction: 7,
            }).start();
            setIsSliding(false);
          },
        },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            try {
              setIsProcessing(true);
              await onConfirm();
              // Reset slider after successful confirmation
              Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: false,
                tension: 50,
                friction: 7,
              }).start();
            } catch (error) {
              // Reset slider on error
              Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: false,
                tension: 50,
                friction: 7,
              }).start();
            } finally {
              setIsProcessing(false);
              setIsSliding(false);
            }
          },
        },
      ]
    );
  };

  const slidePercentage = slideAnim.interpolate({
    inputRange: [0, MAX_SLIDE_DISTANCE],
    outputRange: [0, 100],
  });

  const backgroundColor = slideAnim.interpolate({
    inputRange: [0, MAX_SLIDE_DISTANCE * 0.8, MAX_SLIDE_DISTANCE],
    outputRange: [
      color.status.failed || "#ef4444",
      color.status.failed || "#ef4444",
      "#dc2626",
    ],
  });

  return (
    <View style={styles.container}>
      <View style={styles.warningContainer}>
        <Text style={styles.warningTitle}>⚠️ Emergency End Trip</Text>
        <Text style={styles.warningText}>
          {disabled
            ? disabledMessage
            : "Slide to the right to emergency end this trip. This action can only be used once per day."}
        </Text>
      </View>

      <View
        style={[
          styles.track,
          disabled && styles.trackDisabled,
          isProcessing && styles.trackProcessing,
        ]}
        {...panResponder.panHandlers}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width: slideAnim,
              backgroundColor,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX: slideAnim }],
            },
            disabled && styles.thumbDisabled,
            isProcessing && styles.thumbProcessing,
          ]}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.thumbText}>→</Text>
          )}
        </Animated.View>
        <View style={styles.labelContainer}>
          <Text
            style={[
              styles.labelText,
              disabled && styles.labelTextDisabled,
            ]}
          >
            {disabled
              ? "Unavailable"
              : isProcessing
              ? "Processing..."
              : "Slide to End"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.lg,
  },
  warningContainer: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningTitle: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.bold,
    color: "#dc2626",
    marginBottom: spacing.xs,
  },
  warningText: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.regular,
    color: "#991b1b",
    lineHeight: 20,
  },
  track: {
    width: SLIDER_WIDTH,
    height: TRACK_HEIGHT,
    backgroundColor: "#fee2e2",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: spacing.sm,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#fecaca",
  },
  trackDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#d1d5db",
    opacity: 0.6,
  },
  trackProcessing: {
    opacity: 0.7,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    height: TRACK_HEIGHT,
    borderRadius: 30,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    ...shadows.md,
    zIndex: 10,
  },
  thumbDisabled: {
    backgroundColor: "#9ca3af",
  },
  thumbProcessing: {
    backgroundColor: "#f59e0b",
  },
  thumbText: {
    color: "#fff",
    fontSize: fontSizes.FONT20,
    fontWeight: "bold",
  },
  labelContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  labelText: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.bold,
    color: "#991b1b",
    textAlign: "center",
  },
  labelTextDisabled: {
    color: "#6b7280",
  },
});

