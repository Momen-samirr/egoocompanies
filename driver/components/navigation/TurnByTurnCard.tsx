import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@react-navigation/native";
import { RouteStep } from "@/services/navigationService";
import { fontSizes } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { spacing, shadows } from "@/styles/design-system";

interface TurnByTurnCardProps {
  step: RouteStep | null;
  distanceToTurn: number; // in meters
  visible?: boolean;
}

/**
 * Get turn direction icon/emoji based on maneuver
 */
function getTurnIcon(maneuver?: string): string {
  if (!maneuver) return "→";
  
  const maneuverLower = maneuver.toLowerCase();
  
  if (maneuverLower.includes("left")) {
    return "↶";
  } else if (maneuverLower.includes("right")) {
    return "↷";
  } else if (maneuverLower.includes("straight") || maneuverLower.includes("continue")) {
    return "→";
  } else if (maneuverLower.includes("uturn") || maneuverLower.includes("u-turn")) {
    return "↻";
  } else if (maneuverLower.includes("merge")) {
    return "⇄";
  } else if (maneuverLower.includes("fork")) {
    return "⇉";
  } else if (maneuverLower.includes("ramp")) {
    return "⇗";
  }
  
  return "→";
}

/**
 * Clean HTML instructions to plain text
 */
function cleanInstructions(htmlInstructions: string): string {
  // Remove HTML tags
  let cleaned = htmlInstructions.replace(/<[^>]*>/g, "");
  
  // Decode HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  return cleaned;
}

/**
 * Format distance for display
 */
function formatDistance(meters: number): string {
  if (meters < 100) {
    return `${Math.round(meters)}m`;
  } else if (meters < 1000) {
    return `${Math.round(meters / 10) * 10}m`;
  } else {
    return `${(meters / 1000).toFixed(1)}km`;
  }
}

export default function TurnByTurnCard({
  step,
  distanceToTurn,
  visible = true,
}: TurnByTurnCardProps) {
  const { colors } = useTheme();

  if (!visible || !step) {
    return null;
  }

  const turnIcon = getTurnIcon(step.maneuver);
  const instruction = cleanInstructions(step.html_instructions);
  const distanceText = formatDistance(distanceToTurn);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }, shadows.lg]}>
      <View style={styles.content}>
        {/* Turn Icon */}
        <View style={[styles.iconContainer, { backgroundColor: color.primary + "20" }]}>
          <Text style={styles.icon}>{turnIcon}</Text>
        </View>

        {/* Instruction Text */}
        <View style={styles.textContainer}>
          <Text style={[styles.instruction, { color: colors.text }]} numberOfLines={2}>
            {instruction}
          </Text>
          <Text style={[styles.distance, { color: color.text.secondary }]}>
            {distanceText}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.md,
    right: spacing.md,
    borderRadius: 16,
    padding: spacing.md,
    zIndex: 1000,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  instruction: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.semibold,
    marginBottom: spacing.xs,
  },
  distance: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.regular,
  },
});

