import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import React from "react";
import { useTheme } from "@react-navigation/native";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { spacing } from "@/styles/design-system";
import { Location } from "@/utils/icons";
import StatusBadge from "@/components/common/StatusBadge";
import ETADisplay from "@/components/common/ETADisplay";

interface CheckpointCardProps {
  checkpoint: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    isFinalPoint: boolean;
    reachedAt: string | null;
  };
  isCurrent: boolean;
  isReached: boolean;
  isPast: boolean;
  distance?: number;
  duration?: number;
  onReachPress?: () => void;
  disabled?: boolean;
  showReachButton?: boolean;
}

export default function CheckpointCard({
  checkpoint,
  isCurrent,
  isReached,
  isPast,
  distance,
  duration,
  onReachPress,
  disabled = false,
  showReachButton = false,
}: CheckpointCardProps) {
  const { colors } = useTheme();

  const getBorderColor = () => {
    if (isReached) return color.status.completed;
    if (isCurrent) return color.status.active;
    if (isPast) return color.border;
    return color.border;
  };

  const getBackgroundColor = () => {
    if (isCurrent) return `${color.status.active}10`;
    if (isReached) return `${color.status.completed}10`;
    return colors.card;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: isCurrent ? 2 : 1,
          opacity: isPast && !isReached ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <View
            style={[
              styles.numberBadge,
              {
                backgroundColor: isReached
                  ? color.status.completed
                  : isCurrent
                  ? color.status.active
                  : color.border,
              },
            ]}
          >
            <Text style={styles.numberText}>{checkpoint.order}</Text>
          </View>
          <View style={styles.connector} />
        </View>

        <View style={styles.middleSection}>
          <View style={styles.header}>
            <Text style={[styles.name, { color: colors.text }]}>
              {checkpoint.name}
            </Text>
            {checkpoint.isFinalPoint && (
              <View style={[styles.finalBadge, { backgroundColor: color.status.completed }]}>
                <Text style={styles.finalText}>FINAL</Text>
              </View>
            )}
          </View>

          <View style={styles.locationInfo}>
            <Location color={color.text.tertiary} width={12} height={12} />
            <Text style={[styles.coordinates, { color: color.text.tertiary }]}>
              {checkpoint.latitude.toFixed(6)}, {checkpoint.longitude.toFixed(6)}
            </Text>
          </View>

          {isCurrent && !isReached && (distance !== undefined || duration !== undefined) && (
            <View style={styles.etaContainer}>
              <ETADisplay distance={distance} duration={duration} size="sm" />
            </View>
          )}

          {isReached && checkpoint.reachedAt && (
            <Text style={[styles.reachedText, { color: color.status.completed }]}>
              ✓ Reached at {new Date(checkpoint.reachedAt).toLocaleTimeString()}
            </Text>
          )}
        </View>

        <View style={styles.rightSection}>
          {showReachButton && isCurrent && !isReached && (
            <TouchableOpacity
              onPress={onReachPress}
              disabled={disabled}
              style={[
                styles.reachButton,
                {
                  backgroundColor: disabled ? color.border : color.primary,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.reachButtonText}>Reached</Text>
            </TouchableOpacity>
          )}
          {isReached && (
            <View style={[styles.checkmark, { backgroundColor: color.status.completed }]}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  content: {
    flexDirection: "row",
  },
  leftSection: {
    marginRight: spacing.md,
    alignItems: "center",
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  numberText: {
    color: "#fff",
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.bold,
    fontWeight: "600",
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: color.border,
    marginTop: spacing.xs,
  },
  middleSection: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.medium,
    fontWeight: "600",
    flex: 1,
  },
  finalBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
  finalText: {
    color: "#fff",
    fontSize: fontSizes.FONT10,
    fontFamily: fonts.bold,
    fontWeight: "600",
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  coordinates: {
    fontSize: fontSizes.FONT12,
    fontFamily: fonts.regular,
  },
  etaContainer: {
    marginTop: spacing.xs,
  },
  reachedText: {
    fontSize: fontSizes.FONT12,
    fontFamily: fonts.medium,
    marginTop: spacing.xs,
  },
  rightSection: {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  reachButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  reachButtonText: {
    color: "#fff",
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
    fontWeight: "600",
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: "#fff",
    fontSize: fontSizes.FONT12,
    fontWeight: "bold",
  },
});

