import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { normalizeAngle } from "@/utils/navigation.utils";

interface NavigationArrowProps {
  /**
   * Bearing to destination in degrees (0-360, where 0 is North)
   */
  bearingToDestination: number;
  /**
   * Driver's current heading in degrees (0-360, where 0 is North)
   * If null, arrow will point directly toward destination
   */
  driverHeading: number | null;
  /**
   * Size of the arrow in pixels
   */
  size?: number;
  /**
   * Color of the arrow
   */
  color?: string;
  /**
   * Whether the arrow should be visible
   */
  visible?: boolean;
}


/**
 * Navigation arrow component that points toward destination
 * and rotates based on driver's heading (like Uber's navigation arrow)
 */
export default function NavigationArrow({
  bearingToDestination,
  driverHeading,
  size = 40,
  color = "#3b82f6", // Default to active status color
  visible = true,
}: NavigationArrowProps) {
  // Calculate the rotation angle
  // If we have driver heading, show relative direction (arrow points where to turn)
  // If no heading, arrow points directly toward destination (relative to map North)
  const targetRotation = driverHeading !== null && driverHeading >= 0
    ? bearingToDestination - driverHeading
    : bearingToDestination;

  // Normalize rotation to -180 to 180 for smooth animation
  let normalizedRotation = targetRotation;
  if (normalizedRotation > 180) {
    normalizedRotation -= 360;
  } else if (normalizedRotation < -180) {
    normalizedRotation += 360;
  }

  // Use shared value for smooth rotation animation
  const rotation = useSharedValue(normalizedRotation);
  const opacity = useSharedValue(visible ? 1 : 0);

  // Update rotation with smooth animation
  useEffect(() => {
    // Normalize the target rotation to find shortest path
    let target = normalizedRotation;
    let current = rotation.value;

    // Handle wrap-around (e.g., going from 170° to -170°)
    let diff = target - current;
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }

    // Animate to new rotation
    rotation.value = withSpring(current + diff, {
      damping: 15,
      stiffness: 100,
      mass: 0.5,
    });
  }, [normalizedRotation]);

  // Update opacity
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 200 });
  }, [visible]);

  // Animated style for rotation
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
      opacity: opacity.value,
    };
  }, []);

  if (!visible) {
    return null;
  }

  // Arrow path - pointing upward (will be rotated)
  const arrowWidth = size * 0.6;
  const arrowHeight = size * 0.8;
  const centerX = size / 2;
  const centerY = size / 2;

  // Create an upward-pointing arrow path
  const arrowPath = `
    M ${centerX} ${centerY - arrowHeight / 2}
    L ${centerX - arrowWidth / 2} ${centerY + arrowHeight / 4}
    L ${centerX - arrowWidth / 4} ${centerY + arrowHeight / 4}
    L ${centerX - arrowWidth / 4} ${centerY + arrowHeight / 2}
    L ${centerX + arrowWidth / 4} ${centerY + arrowHeight / 2}
    L ${centerX + arrowWidth / 4} ${centerY + arrowHeight / 4}
    L ${centerX + arrowWidth / 2} ${centerY + arrowHeight / 4}
    Z
  `;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={animatedStyle}>
        <Svg
          width={size}
          height={size}
          style={styles.svg}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Outer circle for better visibility */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={size / 2 - 2}
            fill="rgba(255, 255, 255, 0.95)"
            stroke={color}
            strokeWidth={2.5}
          />
          {/* Arrow */}
          <Path d={arrowPath} fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 30, // Position at bottom center of map
    left: "50%",
    marginLeft: -35, // Half of default size (70)
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    width: 70,
    height: 70,
  },
  svg: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 10,
  },
});

