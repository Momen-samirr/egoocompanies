import { View, StyleSheet, Animated } from "react-native";
import React, { useEffect, useRef } from "react";
import { useTheme } from "@react-navigation/native";
import { spacing } from "@/styles/design-system";
import color from "@/themes/app.colors";

interface LoadingSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export default function LoadingSkeleton({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
}: LoadingSkeletonProps) {
  const { colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border || color.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Pre-built skeleton components
export function SkeletonCard() {
  return (
    <View style={styles.cardContainer}>
      <LoadingSkeleton width="60%" height={20} style={{ marginBottom: spacing.md }} />
      <LoadingSkeleton width="40%" height={16} style={{ marginBottom: spacing.sm }} />
      <LoadingSkeleton width="80%" height={16} />
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={{ marginBottom: spacing.md }}>
          <SkeletonCard />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#E9E9E9",
  },
  cardContainer: {
    padding: spacing.lg,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: spacing.md,
  },
});

