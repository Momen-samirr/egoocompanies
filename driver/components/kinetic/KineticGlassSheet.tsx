import React, { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { kinetic } from "@/styles/design-system";

type KineticGlassSheetProps = {
  children: ReactNode;
};

export default function KineticGlassSheet({ children }: KineticGlassSheetProps) {
  return (
    <BlurView intensity={20} tint="light" style={styles.sheet}>
      <View style={styles.handle} />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderTopLeftRadius: kinetic.radius.xxl,
    borderTopRightRadius: kinetic.radius.xxl,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
    ...kinetic.shadows.ambient,
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: kinetic.radius.full,
    backgroundColor: "rgba(199,196,215,0.5)",
    alignSelf: "center",
    marginBottom: 16,
  },
});

