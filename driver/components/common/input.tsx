import {
  View,
  Text,
  KeyboardTypeOptions,
  StyleSheet,
  TextInput,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import fonts from "@/themes/app.fonts";
import { windowHeight, windowWidth } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import React from "react";

interface InputProps {
  title: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  value?: string;
  warning?: string;
  onChangeText?: (text: string) => void;
  showWarning?: boolean;
  emailFormatWarning?: string;
  disabled?: boolean;
}

const Input = React.memo(
  function Input({
    title,
    placeholder,
    keyboardType,
    value,
    warning,
    onChangeText,
    showWarning,
    emailFormatWarning,
    disabled,
  }: InputProps) {
    const { colors } = useTheme();

    return (
      <View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: color.lightGray,
              borderColor: colors.border,
              opacity: disabled ? 0.6 : 1,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={color.secondaryFont}
          keyboardType={keyboardType}
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          accessibilityLabel={title}
          accessibilityHint={placeholder}
          accessibilityState={{ disabled: !!disabled }}
        />
        {showWarning && <Text style={[styles.warning]}>{warning}</Text>}
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if props actually change
    return (
      prevProps.value === nextProps.value &&
      prevProps.showWarning === nextProps.showWarning &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.title === nextProps.title &&
      prevProps.placeholder === nextProps.placeholder
    );
  }
);

export default Input;

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.medium,
    fontSize: windowWidth(20),
    marginVertical: windowHeight(8),
  },
  input: {
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 5,
    height: windowHeight(30),
    color: color.secondaryFont,
    paddingHorizontal: 10,
  },
  warning: {
    color: color.red,
    marginTop: 3,
  },
});
