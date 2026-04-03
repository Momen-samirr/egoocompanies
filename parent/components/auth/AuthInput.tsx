import React from "react";
import { StyleSheet, TextInput, TextInputProps } from "react-native";

type AuthInputProps = TextInputProps;

export default function AuthInput(props: AuthInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#9A9CA8"
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#EFF1F5",
    paddingHorizontal: 16,
    color: "#1D1E26",
    fontSize: 16,
    marginBottom: 14,
  },
});
