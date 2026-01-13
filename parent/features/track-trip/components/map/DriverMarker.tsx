/**
 * Driver marker component with rotation animation
 */

import React, { useEffect, useRef } from "react";
import { StyleSheet, Animated, Image } from "react-native";
import { Marker } from "react-native-maps";
import { Coordinate, DriverLocation } from "../../types";

/**
 * Props for DriverMarker component
 */
export interface DriverMarkerProps {
  coordinate: Coordinate;
  heading?: number;
  driverName?: string;
  updateKey?: number | string; // Key to force remount
  onPress?: () => void;
}

/**
 * Driver marker with car icon and rotation animation
 */
export function DriverMarker({
  coordinate,
  heading,
  driverName = "Driver",
  updateKey,
  onPress,
}: DriverMarkerProps) {
  const rotationAnim = useRef(new Animated.Value(heading || 0)).current;
  const previousHeading = useRef<number | null>(null);

  useEffect(() => {
    if (heading !== undefined) {
      // Smooth rotation animation
      if (previousHeading.current !== null) {
        // Calculate shortest rotation path
        let targetRotation = heading;
        const currentRotation = previousHeading.current;
        const diff = targetRotation - currentRotation;

        // Handle 360/0 wrap-around
        if (Math.abs(diff) > 180) {
          if (diff > 0) {
            targetRotation = currentRotation - (360 - diff);
          } else {
            targetRotation = currentRotation + (360 + diff);
          }
        } else {
          targetRotation = currentRotation + diff;
        }

        Animated.timing(rotationAnim, {
          toValue: targetRotation,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } else {
        rotationAnim.setValue(heading);
      }

      previousHeading.current = heading;
    }
  }, [heading, rotationAnim]);

  return (
    <Marker
      key={`driver-marker-${updateKey || 0}`}
      coordinate={coordinate}
      title="Driver"
      description={driverName}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={false}
      tracksViewChanges={true}
      zIndex={1000}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.driverMarker,
          {
            transform: [
              {
                rotate: rotationAnim.interpolate({
                  inputRange: [0, 360],
                  outputRange: ["0deg", "360deg"],
                }),
              },
            ],
          },
        ]}
      >
        <Image
          source={require("../../../assets/images/car.png")}
          style={styles.carImage}
          resizeMode="contain"
        />
      </Animated.View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  driverMarker: {
    backgroundColor: "#6366f1",
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  carImage: {
    width: 32,
    height: 32,
  },
});

