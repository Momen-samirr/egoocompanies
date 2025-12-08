import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { spacing } from "@/styles/design-system";
import { fontSizes } from "@/themes/app.constant";
import fonts from "@/themes/app.fonts";
import color from "@/themes/app.colors";

/**
 * OfflineIndicator Component
 * Shows a banner when the device is offline
 */
export default function OfflineIndicator() {
  const { isOnline } = useNetworkStatus();
  const [hasChecked, setHasChecked] = React.useState(false);

  React.useEffect(() => {
    // Only show offline indicator after we've confirmed we're offline
    // This prevents showing it during initial connectivity check
    if (!isOnline) {
      // Small delay to avoid flickering on app startup
      const timer = setTimeout(() => {
        setHasChecked(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setHasChecked(false);
    }
  }, [isOnline]);

  // Don't show offline indicator until we've confirmed offline status
  if (isOnline || !hasChecked) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>No Internet Connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: color.semantic.error,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
  },
  text: {
    color: "#fff",
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
    fontWeight: "600",
  },
});
