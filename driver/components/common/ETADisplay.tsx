import { View, Text, StyleSheet } from "react-native";
import React from "react";
import { useTheme } from "@react-navigation/native";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { spacing } from "@/styles/design-system";
import { Location } from "@/utils/icons";
import { Clock } from "@/assets/icons/clock";
import { View as ViewRN } from "react-native";

interface ETADisplayProps {
  distance?: number; // in kilometers
  duration?: number; // in minutes
  distanceUnit?: "km" | "m";
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

function ETADisplay({
  distance,
  duration,
  distanceUnit = "km",
  showIcon = true,
  size = "md",
}: ETADisplayProps) {
  const { colors } = useTheme();

  const formatDistance = () => {
    if (!distance) return "—";
    if (distanceUnit === "m" || distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const formatDuration = () => {
    if (!duration) return "—";
    if (duration < 60) {
      return `${Math.round(duration)}min`;
    }
    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  };

  const sizeStyles = {
    sm: {
      fontSize: fontSizes.FONT12,
      iconSize: 14,
      gap: spacing.xs,
    },
    md: {
      fontSize: fontSizes.FONT14,
      iconSize: 16,
      gap: spacing.sm,
    },
    lg: {
      fontSize: fontSizes.FONT16,
      iconSize: 18,
      gap: spacing.md,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View style={styles.container}>
      {distance !== undefined && (
        <View style={[styles.item, { gap: currentSize.gap }]}>
          {showIcon && (
            <Location color={color.text.secondary} width={currentSize.iconSize} height={currentSize.iconSize} />
          )}
          <Text style={[styles.text, { fontSize: currentSize.fontSize, color: colors.text }]}>
            {formatDistance()}
          </Text>
        </View>
      )}
      {duration !== undefined && (
        <View style={[styles.item, { gap: currentSize.gap, marginLeft: distance !== undefined ? spacing.md : 0 }]}>
          {showIcon && (
            <ViewRN style={{ width: currentSize.iconSize, height: currentSize.iconSize }}>
              <Clock />
            </ViewRN>
          )}
          <Text style={[styles.text, { fontSize: currentSize.fontSize, color: colors.text }]}>
            {formatDuration()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    fontFamily: fonts.medium,
  },
});

// Memoize component to prevent unnecessary re-renders
export default React.memo(ETADisplay, (prevProps, nextProps) => {
  // Only re-render if distance, duration, or size changes
  return (
    prevProps.distance === nextProps.distance &&
    prevProps.duration === nextProps.duration &&
    prevProps.distanceUnit === nextProps.distanceUnit &&
    prevProps.size === nextProps.size &&
    prevProps.showIcon === nextProps.showIcon
  );
});

