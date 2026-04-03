import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, Switch } from "react-native";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";
import { spacing, kinetic } from "@/styles/design-system";

interface DriverStatusCardProps {
  isOnline: boolean;
  isLoading: boolean;
  onToggle: () => void;
  wsConnected?: boolean;
  showConnectionStatus?: boolean;
}

export default function DriverStatusCard({
  isOnline,
  isLoading,
  onToggle,
  wsConnected = true,
  showConnectionStatus = true,
}: DriverStatusCardProps) {
  const statusText = "Availability";
  const buttonText = isOnline ? "Go Offline" : "Go Online";
  const statusSubtext = isOnline
    ? "Receiving trip requests"
    : "Tap to receive trip requests";

  // Keep props referenced for compatibility while this compact card
  // intentionally does not render connection state in the new design.
  void wsConnected;
  void showConnectionStatus;

  return (
    <View style={[styles.container, kinetic.shadows.soft]}>
      <View style={styles.content}>
        <View style={styles.textSection}>
          <Text style={styles.statusText}>{statusText}</Text>
          <Text style={styles.subtext}>{statusSubtext}</Text>
        </View>

        <View style={styles.switchWrap}>
          {isLoading ? (
            <ActivityIndicator size="small" color={color.primary} />
          ) : (
            <Switch
              value={isOnline}
              onValueChange={onToggle}
              disabled={isLoading}
              trackColor={{
                false: "#D2D7E0",
                true: color.primary,
              }}
              thumbColor={color.whiteColor}
              ios_backgroundColor="#D2D7E0"
              accessibilityRole="switch"
              accessibilityLabel={buttonText}
              accessibilityState={{ checked: isOnline, disabled: isLoading }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: color.whiteColor,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ECEEF4",
  },
  content: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  textSection: {
    flex: 1,
    paddingRight: spacing.md,
  },
  statusText: {
    fontSize: fontSizes.FONT24,
    fontFamily: fonts.bold,
    color: kinetic.colors.onSurface,
    marginBottom: 2,
  },
  subtext: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.regular,
    color: kinetic.colors.onSurfaceVariant,
  },
  switchWrap: {
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
});
