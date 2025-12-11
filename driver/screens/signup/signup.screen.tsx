import { View, Text, ScrollView, Keyboard } from "react-native";
import React, { useState, useCallback } from "react";
import { windowHeight, windowWidth } from "@/themes/app.constant";
import ProgressBar from "@/components/common/progress.bar";
import styles from "./styles";
import { useTheme } from "@react-navigation/native";
import TitleView from "@/components/signup/title.view";
import Input from "@/components/common/input";
import SelectInput from "@/components/common/select-input";
import { countryNameItems } from "@/configs/country-name-list";
import Button from "@/components/common/button";
import color from "@/themes/app.colors";
import { router } from "expo-router";

export default function SignupScreen() {
  const { colors } = useTheme();
  const [emailFormatWarning, setEmailFormatWarning] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    email: "",
    country: "880", // Store the value (country code), not the label
  });

  const handleChange = (key: string, value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      [key]: value,
    }));

    // Validate email format when email changes
    if (key === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value.trim() !== "" && !emailRegex.test(value)) {
        setEmailFormatWarning("Please enter a valid email address!");
      } else {
        setEmailFormatWarning("");
      }
    }
  };

  const gotoDocument = useCallback(() => {
    // Dismiss keyboard
    Keyboard.dismiss();

    console.log("🔵 Next button pressed!");
    console.log("🔵 Form data:", formData);

    // Validate all required fields
    const isNameEmpty = formData.name.trim() === "";
    const isCountryEmpty = !formData.country || formData.country.trim() === "";
    const isPhoneNumberEmpty = formData.phoneNumber.trim() === "";
    const isEmailEmpty = formData.email.trim() === "";

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailInvalid = !isEmailEmpty && !emailRegex.test(formData.email);

    console.log("🔵 Validation check:", {
      isNameEmpty,
      isCountryEmpty,
      isPhoneNumberEmpty,
      isEmailEmpty,
      isEmailInvalid,
    });

    // Check if any validation fails
    if (
      isNameEmpty ||
      isCountryEmpty ||
      isPhoneNumberEmpty ||
      isEmailEmpty ||
      isEmailInvalid
    ) {
      console.log("🔴 Validation failed - showing warnings");
      setShowWarning(true);
      // Update email format warning if email is invalid
      if (isEmailInvalid) {
        setEmailFormatWarning("Please enter a valid email address!");
      } else {
        setEmailFormatWarning("");
      }
      return;
    }

    console.log("✅ All validations passed - proceeding to next screen");

    // All validations passed, proceed to next screen
    setShowWarning(false);
    setEmailFormatWarning("");

    const phoneNumberData = countryNameItems.find(
      (i: any) => i.value === formData.country
    );

    // Remove ALL + signs from value to avoid double plus (++)
    const cleanCountryCode = (phoneNumberData?.value || formData.country || "")
      .toString()
      .replace(/\+/g, "")
      .trim();
    console.log("Signup - Original country:", formData.country);
    console.log("Signup - PhoneNumberData value:", phoneNumberData?.value);
    console.log("Signup - Cleaned countryCode:", cleanCountryCode);
    const phone_number = `+${cleanCountryCode}${formData.phoneNumber}`;
    console.log("Signup - Final phone_number:", phone_number);

    const driverData = {
      name: formData.name,
      country: phoneNumberData?.label || formData.country, // Use the label for display
      phone_number: phone_number,
      email: formData.email,
    };

    console.log(
      "Signup - Navigating to document-verification with data:",
      driverData
    );

    try {
      router.push({
        pathname: "/(routes)/document-verification",
        params: driverData as any,
      });
      console.log("✅ Navigation initiated successfully");
    } catch (error) {
      console.error("❌ Navigation error:", error);
    }
  }, [formData]);

  return (
    <ScrollView>
      <View>
        {/* logo */}
        <Text
          style={{
            fontFamily: "TT-Octosquares-Medium",
            fontSize: windowHeight(22),
            paddingTop: windowHeight(50),
            textAlign: "center",
          }}
        >
          Egoo
        </Text>
        <View style={{ padding: windowWidth(20) }}>
          <ProgressBar fill={1} />
          <View
            style={[styles.subView, { backgroundColor: colors.background }]}
          >
            <View style={styles.space}>
              <TitleView
                title={"Create your account"}
                subTitle={"Explore your life by joining Egoo"}
              />
              <Input
                title="Name"
                placeholder="Enter your name"
                value={formData.name}
                onChangeText={(text) => handleChange("name", text)}
                showWarning={showWarning && formData.name === ""}
                warning={"Please enter your name!"}
              />
              <SelectInput
                title="Country"
                placeholder="Select your country"
                value={formData.country}
                onValueChange={(text) => {
                  // Clean the country code: remove ALL + signs and ensure we have the numeric value
                  const cleanCode = (text || "")
                    .toString()
                    .replace(/\+/g, "")
                    .trim();
                  console.log(
                    "Signup - Received:",
                    text,
                    "Cleaned:",
                    cleanCode
                  );
                  handleChange("country", cleanCode);
                }}
                showWarning={showWarning && !formData.country}
                items={countryNameItems}
              />
              <Input
                title="Phone Number"
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                value={formData.phoneNumber}
                onChangeText={(text) => handleChange("phoneNumber", text)}
                showWarning={showWarning && formData.phoneNumber === ""}
                warning={"Please enter your phone number!"}
              />
              <Input
                title={"Email Address"}
                placeholder={"Enter your email address"}
                keyboardType="email-address"
                value={formData.email}
                onChangeText={(text) => handleChange("email", text)}
                showWarning={
                  showWarning &&
                  (formData.email === "" || emailFormatWarning !== "")
                }
                warning={
                  formData.email === ""
                    ? "Please enter your email!"
                    : "Please enter a valid email!"
                }
                emailFormatWarning={emailFormatWarning}
              />
            </View>
            <View style={styles.margin}>
              <Button
                onPress={gotoDocument}
                height={windowHeight(30)}
                title={"Next"}
                backgroundColor={color.buttonBg}
                textColor={color.whiteColor}
              />
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
