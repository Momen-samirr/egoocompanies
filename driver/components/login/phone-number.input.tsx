import { View, Text, TextInput } from "react-native";
import { commonStyles } from "@/styles/common.style";
import { windowHeight, windowWidth } from "@/themes/app.constant";
import { external } from "@/styles/external.style";
import styles from "@/screens/login/styles";
import color from "@/themes/app.colors";
import { countryItems } from "@/configs/country-list";
import SelectInput from "../common/select-input";
import React, { useRef, useState, useEffect } from "react";

interface Props {
  width?: number;
  phone_number: string;
  setphone_number: (phone_number: string) => void;
  countryCode: string;
  setCountryCode: (countryCode: string) => void;
}

export default function PhoneNumberInput({
  width,
  phone_number,
  setphone_number,
  countryCode,
  setCountryCode,
}: Props) {
  const textInputRef = useRef<TextInput>(null);
  const isUserInputRef = useRef(false);
  // Use local state to manage the input value
  const [localPhoneNumber, setLocalPhoneNumber] = useState(phone_number);

  // Sync local state with prop when it changes from parent (not from user input)
  useEffect(() => {
    console.log(
      "PhoneNumberInput - useEffect triggered, phone_number prop:",
      phone_number,
      "localPhoneNumber:",
      localPhoneNumber,
      "isUserInput:",
      isUserInputRef.current
    );
    if (!isUserInputRef.current) {
      if (phone_number !== localPhoneNumber) {
        console.log(
          "PhoneNumberInput - Syncing prop to local state:",
          phone_number
        );
        setLocalPhoneNumber(phone_number);
      }
    } else {
      console.log("PhoneNumberInput - Skipping sync (user input in progress)");
    }
    // Reset flag after a delay to allow state updates to complete
    const timeoutId = setTimeout(() => {
      isUserInputRef.current = false;
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [phone_number]);

  const handlePhoneNumberChange = (text: string) => {
    console.log("PhoneNumberInput - onChangeText called with:", text);
    console.log(
      "PhoneNumberInput - Current localPhoneNumber:",
      localPhoneNumber
    );
    console.log("PhoneNumberInput - Current phone_number prop:", phone_number);
    isUserInputRef.current = true; // Mark as user input
    setLocalPhoneNumber(text);
    // Immediately sync to parent
    console.log("PhoneNumberInput - Calling setphone_number with:", text);
    setphone_number(text);
    console.log("PhoneNumberInput - After setphone_number call");
  };

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={[commonStyles.mediumTextBlack, { marginTop: windowHeight(8) }]}
        >
          Phone Number
        </Text>
        {__DEV__ && (
          <Text
            style={{ fontSize: 10, color: "red", marginTop: windowHeight(8) }}
          >
            Debug: {localPhoneNumber || "(empty)"} | Prop:{" "}
            {phone_number || "(empty)"}
          </Text>
        )}
      </View>
      <View
        style={[
          external.fd_row,
          external.ai_center,
          external.mt_5,
          { flexDirection: "row" },
        ]}
      >
        <View
          style={[
            styles.countryCodeContainer,
            {
              borderColor: color.border,
            },
          ]}
        >
          <SelectInput
            placeholder="Select your country"
            value={countryCode}
            onValueChange={(text) => {
              // Only update if we have a valid value (not null or empty)
              // This prevents RNPickerSelect from clearing the value when user cancels or placeholder is shown
              if (text !== null && text !== undefined && text !== "") {
                // Clean the country code: remove ALL + signs and ensure we have the numeric value
                const cleanCode = text.toString().replace(/\+/g, "").trim();
                console.log(
                  "PhoneNumberInput - Received:",
                  text,
                  "Cleaned:",
                  cleanCode,
                  "Current countryCode:",
                  countryCode
                );
                // Only update if we have a valid cleaned code
                if (cleanCode && cleanCode.length > 0) {
                  setCountryCode(cleanCode);
                } else {
                  console.log("PhoneNumberInput - Ignoring empty/invalid code");
                }
              } else {
                console.log(
                  "PhoneNumberInput - Ignoring null/undefined/empty value, keeping current:",
                  countryCode
                );
              }
            }}
            showWarning={false}
            warning={"Please choose your country code!"}
            items={countryItems}
          />
        </View>
        <View
          style={[
            styles.phoneNumberInput,
            {
              width: width || windowWidth(346),
              borderColor: color.border,
            },
          ]}
          pointerEvents="box-none"
        >
          <TextInput
            ref={textInputRef}
            style={[commonStyles.regularText]}
            placeholderTextColor={color.subtitle}
            placeholder={"Enter your number"}
            keyboardType="numeric"
            value={localPhoneNumber}
            onChangeText={(text) => {
              console.log("TextInput - Direct onChangeText:", text);
              handlePhoneNumberChange(text);
            }}
            onFocus={() => {
              console.log("TextInput - onFocus called");
              console.log("TextInput - Current local value:", localPhoneNumber);
              console.log("TextInput - Current prop value:", phone_number);
            }}
            onBlur={() => {
              console.log("TextInput - onBlur called");
              console.log("TextInput - Final local value:", localPhoneNumber);
              console.log("TextInput - Final prop value:", phone_number);
            }}
            onPressIn={() => console.log("TextInput - onPressIn called")}
            maxLength={10}
            autoComplete="tel"
            textContentType="telephoneNumber"
            editable={true}
            selectTextOnFocus={false}
          />
        </View>
      </View>
    </View>
  );
}
