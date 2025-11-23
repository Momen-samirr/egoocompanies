import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Linking, Platform, StyleSheet } from "react-native";
import { useTheme } from "@react-navigation/native";
import { checkGooglePlayServices } from "@/utils/mapDiagnostics";
import color from "@/themes/app.colors";
import { spacing } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";

interface GooglePlayServicesCheckProps {
  onAvailable?: () => void;
  onUnavailable?: () => void;
  showWarning?: boolean;
}

/**
 * Component to check and display Google Play Services status
 * Only relevant for Android devices
 */
export default function GooglePlayServicesCheck({
  onAvailable,
  onUnavailable,
  showWarning = true,
}: GooglePlayServicesCheckProps) {
  const { colors } = useTheme();
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (Platform.OS !== "android") {
      setIsAvailable(null);
      setIsChecking(false);
      if (onAvailable) onAvailable();
      return;
    }

    const checkServices = async () => {
      setIsChecking(true);
      try {
        const available = await checkGooglePlayServices();
        setIsAvailable(available);
        
        if (available) {
          if (onAvailable) onAvailable();
        } else {
          if (onUnavailable) onUnavailable();
        }
      } catch (error) {
        console.error("Error checking Google Play Services:", error);
        setIsAvailable(false);
        if (onUnavailable) onUnavailable();
      } finally {
        setIsChecking(false);
      }
    };

    checkServices();
  }, []);

  const openPlayStore = () => {
    Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.gms");
  };

  // Don't show anything if not Android or if services are available
  if (Platform.OS !== "android" || isAvailable === true || isAvailable === null) {
    return null;
  }

  // Don't show warning if showWarning is false
  if (!showWarning) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        <Text style={[styles.icon]}>⚠️</Text>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            Google Play Services Required
          </Text>
          <Text style={[styles.message, { color: colors.text }]}>
            Google Maps requires Google Play Services to function properly. Please update or install it from the Play Store.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: color.primary }]}
          onPress={openPlayStore}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Open Play Store</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: 8,
    margin: spacing.md,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    alignItems: "center",
  },
  icon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  textContainer: {
    marginBottom: spacing.md,
    alignItems: "center",
  },
  title: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.bold,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  message: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.regular,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    minWidth: 150,
  },
  buttonText: {
    color: "white",
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.bold,
    textAlign: "center",
  },
});

