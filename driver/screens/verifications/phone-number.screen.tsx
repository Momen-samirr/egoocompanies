import { View, Text, TouchableOpacity } from "react-native";
import React, { useState } from "react";
import SignInText from "@/components/login/signin.text";
import Button from "@/components/common/button";
import { external } from "@/styles/external.style";
import { router, useLocalSearchParams } from "expo-router";
import { commonStyles } from "@/styles/common.style";
import color from "@/themes/app.colors";
import OTPTextInput from "react-native-otp-textinput";
import { style } from "./style";
import AuthContainer from "@/utils/container/auth-container";
import { windowHeight } from "@/themes/app.constant";
import axios from "axios";
import { Toast } from "react-native-toast-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getServerUri } from "@/configs/constants";

export default function PhoneNumberVerificationScreen() {
  const driver = useLocalSearchParams();
  const [otp, setOtp] = useState("");
  const [loader, setLoader] = useState(false);

  const handleSubmit = async () => {
    if (otp === "") {
      Toast.show("Please fill the fields!", {
        placement: "bottom",
      });
      return;
    }
    
    // Trim and clean the OTP to remove any whitespace
    const otpNumbers = otp.trim().replace(/\s+/g, "");
    
    if (otpNumbers.length !== 4) {
      Toast.show("Please enter a valid 4-digit OTP!", {
        placement: "bottom",
        type: "danger",
      });
      return;
    }
    
    if (driver.name) {
      setLoader(true);
      await axios
        .post(`${getServerUri()}/driver/verify-otp`, {
          phone_number: driver.phone_number,
          otp: otpNumbers,
          ...driver,
        })
        .then((res) => {
          setLoader(false);
          const driverData = {
            ...driver,
            token: res.data.token,
          };
          router.push({
            pathname: "/(routes)/email-verification",
            params: driverData,
          });
        })
        .catch((error) => {
          setLoader(false);
          console.error('OTP verification error:', error);
          const errorMessage = error.response?.data?.message || "Your OTP is incorrect or expired!";
          Toast.show(errorMessage, {
            placement: "bottom",
            type: "danger",
            duration: 4000,
          });
        });
    } else {
      setLoader(true);
      await axios
        .post(`${getServerUri()}/driver/login`, {
          phone_number: driver.phone_number,
          otp: otpNumbers,
        })
        .then(async (res) => {
          setLoader(false);
          await AsyncStorage.setItem("accessToken", res.data.accessToken);
          router.push("/(tabs)/home");
        })
        .catch((error) => {
          setLoader(false);
          console.error('Login OTP verification error:', error);
          const errorMessage = error.response?.data?.message || "Your OTP is incorrect or expired!";
          Toast.show(errorMessage, {
            placement: "bottom",
            type: "danger",
            duration: 4000,
          });
        });
    }
  };
  return (
    <AuthContainer
      topSpace={windowHeight(240)}
      imageShow={true}
      container={
        <View>
          <SignInText
            title={"Phone Number Verification"}
            subtitle={"Check your phone number for the otp!"}
          />
          <OTPTextInput
            handleTextChange={(code) => setOtp(code)}
            inputCount={4}
            textInputStyle={style.otpTextInput}
            tintColor={color.subtitle}
            autoFocus={false}
          />
          <View style={[external.mt_30]}>
            <Button
              title="Verify"
              height={windowHeight(30)}
              onPress={() => handleSubmit()}
              disabled={loader}
            />
          </View>
          <View style={[external.mb_15]}>
            <View
              style={[
                external.pt_10,
                external.Pb_10,
                {
                  flexDirection: "row",
                  gap: 5,
                  justifyContent: "center",
                },
              ]}
            >
              <Text style={[commonStyles.regularText]}>Not Received yet?</Text>
              <TouchableOpacity>
                <Text style={[style.signUpText, { color: "#000" }]}>
                  Resend it
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      }
    />
  );
}
