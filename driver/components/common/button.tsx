import { Pressable, StyleSheet, Text } from "react-native";
import React from "react";
import { commonStyles } from "@/styles/common.style";
import color from "@/themes/app.colors";
import { windowHeight } from "@/themes/app.constant";
import { external } from "@/styles/external.style";

interface ButtonProps {
  title: string;
  onPress: () => void;
  width?: string | number;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = React.memo(
  ({ title, onPress, width, height, backgroundColor, textColor, disabled }) => {
    const widthNumber = width || "100%";
    return (
      <Pressable
        style={[
          styles.container,
          {
            width: widthNumber,
            height: height,
            backgroundColor: backgroundColor || color.buttonBg,
            minHeight: 44, // Minimum touch target size
          },
        ]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        accessibilityHint={disabled ? "Button is disabled" : undefined}
      >
        <Text
          style={[
            commonStyles.extraBold,
            { color: textColor || color.whiteColor },
          ]}
        >
          {title}
        </Text>
      </Pressable>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if props actually change
    return (
      prevProps.title === nextProps.title &&
      prevProps.onPress === nextProps.onPress &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.width === nextProps.width &&
      prevProps.height === nextProps.height &&
      prevProps.backgroundColor === nextProps.backgroundColor &&
      prevProps.textColor === nextProps.textColor
    );
  }
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: color.buttonBg,
    height: windowHeight(40),
    borderRadius: 6,
    ...external.ai_center,
    ...external.js_center,
  },
});

export default Button;
