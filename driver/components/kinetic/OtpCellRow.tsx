import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import fonts from "@/themes/app.fonts";
import { kinetic } from "@/styles/design-system";

type OtpCellRowProps = {
  value: string;
  onChangeText: (v: string) => void;
  length?: number;
};

export default function OtpCellRow({
  value,
  onChangeText,
  length = 4,
}: OtpCellRowProps) {
  const chars = value.padEnd(length, " ").slice(0, length).split("");
  return (
    <View style={styles.row}>
      {chars.map((char, idx) => (
        <View key={idx} style={styles.cell}>
          <TextInput
            value={char.trim()}
            onChangeText={(digit) => {
              const onlyDigit = digit.replace(/\D/g, "").slice(-1);
              const asArray = value.padEnd(length, " ").slice(0, length).split("");
              asArray[idx] = onlyDigit || " ";
              onChangeText(asArray.join("").trim());
            }}
            keyboardType="number-pad"
            maxLength={1}
            style={styles.input}
            placeholder="0"
            placeholderTextColor="#B6B8C3"
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-start",
  },
  cell: {
    width: 60,
    height: 64,
    borderRadius: 16,
    backgroundColor: kinetic.colors.surfaceLow,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    textAlign: "center",
    color: kinetic.colors.onSurface,
    fontSize: 26,
    fontFamily: fonts.bold,
    borderBottomColor: kinetic.colors.primary,
    borderBottomWidth: 2,
  },
});

