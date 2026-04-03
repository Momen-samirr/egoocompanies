import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
  Easing,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";
import { kinetic, spacing } from "@/styles/design-system";

interface TripManagePreviewProps {
  imageSource?: ImageSourcePropType;
}

const DEFAULT_MAP_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAJWQhrAtoAUhvpAhFpHDZ36L9ERhxSAiU1LbjGuSUdSqhAvofxJH8_pgFSFCEcgVlr6xc0R7G568M9mNKgWQeJfk1JtvCez9EWysT41-mu0vxDwWHQ3fYEHLn2oVAX61aakTHr3Isl9KoZm-dT8jGbkA3R-OqhuBJVr6vVFuCeU5ZratKL-ybOphYcMaw-sCKgv_rJ9hXtW5yfSakXqi8i02M0DZ6EXIiq2chAFHZ2mQI047gp2sYgenDtkPM645ka8xec0Byc-f-w";

export default function TripManagePreview({ imageSource }: TripManagePreviewProps) {
  const pulse = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [pulse]);

  const source = imageSource || { uri: DEFAULT_MAP_IMAGE };

  return (
    <View style={styles.wrapper}>
      <View style={styles.shadowLayer} />
      <View style={styles.card}>
        <View style={styles.mapWrap}>
          <Image source={source} style={styles.mapImage} resizeMode="cover" />
          <View style={styles.liveSyncChip}>
            <Animated.View style={[styles.liveDot, { transform: [{ scale: pulse }] }]} />
            <Text style={styles.liveSyncText}>LIVE SYNC</Text>
          </View>
        </View>

        <View style={styles.infoList}>
          <View style={styles.infoCard}>
            <View style={styles.iconBoxPrimary}>
              <Ionicons name="time-outline" size={16} color={kinetic.colors.primary} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.label}>Next Pickup</Text>
              <Text style={styles.value}>08:45 AM • Downtown{"\n"}Terminal</Text>
            </View>
          </View>

          <View style={[styles.infoCard, styles.infoCardMuted]}>
            <View style={styles.iconBoxMuted}>
              <Ionicons name="location-outline" size={16} color="#8D8F99" />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.label, styles.mutedText]}>Drop-off</Text>
              <Text style={[styles.value, styles.mutedText]}>09:15 AM • North Station</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    aspectRatio: 0.81,
    marginTop: spacing.sm,
  },
  shadowLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 36,
    backgroundColor: kinetic.colors.surfaceLow,
    transform: [{ rotate: "-2deg" }],
  },
  card: {
    flex: 1,
    borderRadius: 36,
    backgroundColor: kinetic.colors.surfaceLowest,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(199,196,215,0.22)",
    ...kinetic.shadows.ambient,
  },
  mapWrap: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  mapImage: {
    width: "100%",
    height: "100%",
  },
  liveSyncChip: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: kinetic.colors.success,
  },
  liveSyncText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT10,
    color: kinetic.colors.onSurfaceVariant,
    letterSpacing: 0.8,
  },
  infoList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  infoCard: {
    backgroundColor: kinetic.colors.surfaceLow,
    borderRadius: 18,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  infoCardMuted: {
    opacity: 0.62,
  },
  iconBoxPrimary: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(70,72,212,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxMuted: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#E6E7EA",
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  label: {
    color: kinetic.colors.onSurfaceVariant,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT12,
    marginBottom: 2,
  },
  value: {
    color: "#1A1C1E",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT20,
    lineHeight: 24,
  },
  mutedText: {
    color: "#676C77",
  },
});
