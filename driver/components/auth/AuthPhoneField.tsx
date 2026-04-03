import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import RNPickerSelect from "react-native-picker-select";
import { countryItems } from "@/configs/country-list";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";

type AuthPhoneFieldProps = {
  phoneNumber: string;
  onPhoneNumberChange: (value: string) => void;
  countryCode: string;
  onCountryCodeChange: (value: string) => void;
};

export default function AuthPhoneField({
  phoneNumber,
  onPhoneNumberChange,
  countryCode,
  onCountryCodeChange,
}: AuthPhoneFieldProps) {
  return (
    <View style={styles.row}>
      <View style={styles.countryWrap}>
        <RNPickerSelect
          onValueChange={(value) => {
            if (!value) return;
            onCountryCodeChange(value.toString().replace(/\+/g, "").trim());
          }}
          items={countryItems}
          value={countryCode}
          placeholder={{ label: "+20", value: "20" }}
          style={{
            inputIOS: styles.countryInput,
            inputAndroid: styles.countryInput,
            iconContainer: { top: 14, right: 10 },
          }}
          useNativeAndroidPickerStyle={false}
        />
      </View>

      <View style={styles.numberWrap}>
        <TextInput
          placeholder="(555) 000-0000"
          placeholderTextColor="#9A9CA8"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={onPhoneNumberChange}
          style={styles.numberInput}
          maxLength={14}
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  countryWrap: {
    width: 88,
    borderRadius: 16,
    backgroundColor: "#EFF1F5",
  },
  countryInput: {
    height: 56,
    fontFamily: fonts.bold,
    color: "#1D1E26",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingRight: 26,
  },
  numberWrap: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#EFF1F5",
    borderWidth: 1,
    borderColor: "transparent",
  },
  numberInput: {
    height: 56,
    paddingHorizontal: 16,
    color: "#1D1E26",
    fontFamily: fonts.medium,
    fontSize: 16,
  },
});
