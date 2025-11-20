import { View, Text, Image, TouchableOpacity } from "react-native";
import React, { useState } from "react";
import AuthContainer from "@/utils/container/auth-container";
import { windowHeight, windowWidth } from "@/themes/app.constant";
import styles from "./styles";
import Images from "@/utils/images";
import SignInText from "@/components/login/signin.text";
import { external } from "@/styles/external.style";
import Button from "@/components/common/button";
import { router } from "expo-router";
import PhoneNumberInput from "@/components/login/phone-number.input";
import { Toast } from "react-native-toast-notifications";
import axios from "axios";
import { getServerUri } from "@/configs/constants";
 
export default function LoginScreen() {
  const [phone_number, setphone_number] = useState("");
  const [loading, setloading] = useState(false);
  const [countryCode, setCountryCode] = useState("20");

  const handleSubmit = async () => {
    if (phone_number === "" || countryCode === "") {
      Toast.show("Please fill the fields!", {
        placement: "bottom",
      });
    } else {
      setloading(true);
      // Remove ALL + signs from countryCode to avoid double plus (++)
      const cleanCountryCode = (countryCode || '').toString().replace(/\+/g, '').trim();
      console.log('Original countryCode:', countryCode);
      console.log('Cleaned countryCode:', cleanCountryCode);
      const phoneNumber = `+${cleanCountryCode}${phone_number}`;
      console.log('Final phoneNumber:', phoneNumber);
      console.log('Sending OTP request to:', `${getServerUri()}/driver/send-otp`);
      console.log('Phone number:', phoneNumber);

      await axios
        .post(
          `${getServerUri()}/driver/send-otp`,
          {
            phone_number: phoneNumber,
          },
          {
            timeout: 10000, // 10 second timeout
          }
        )
        .then((res) => {
          console.log('OTP sent successfully');
          setloading(false);
          const driver = {
            phone_number: phoneNumber,
          };
          router.push({
            pathname: "/(routes)/verification-phone-number",
            params: driver,
          });
        })
        .catch((error) => {
          setloading(false);
          console.error('Error sending OTP:', error);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            status: error.response?.status,
            serverUri: getServerUri(),
          });

          // Provide more helpful error messages
          let errorMessage = "Something went wrong! Please re-check your phone number!";
          
          if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage = "Request timed out. Please check your internet connection and try again.";
          } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
            errorMessage = "Cannot connect to server. Please check your internet connection and ensure the server is running.";
          } else if (error.response) {
            // Server responded with error status
            errorMessage = error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`;
          } else if (error.request) {
            // Request was made but no response received
            errorMessage = "No response from server. Please check if the server is running and accessible.";
          }

          Toast.show(errorMessage, {
            type: "danger",
            placement: "bottom",
            duration: 4000,
          });
        });
    }
  };

  return (
    <AuthContainer
      topSpace={windowHeight(150)}
      imageShow={true}
      container={
        <View>
          <View>
            <View>
              <Image style={styles.transformLine} source={Images.line} />
              <SignInText />
              <View style={[external.mt_25, external.Pb_10]}>
                <PhoneNumberInput
                  phone_number={phone_number}
                  setphone_number={setphone_number}
                  countryCode={countryCode}
                  setCountryCode={setCountryCode}
                />
                <View style={[external.mt_25, external.Pb_15]}>
                  <Button
                    title="Get Otp"
                    disabled={loading}
                    height={windowHeight(35)}
                    onPress={() => handleSubmit()}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: windowWidth(8),
                    paddingBottom: windowHeight(15),
                  }}
                >
                  <Text style={{ fontSize: windowHeight(12) }}>
                    Don't have any rider account?
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(routes)/signup")}
                  >
                    <Text style={{ color: "blue", fontSize: windowHeight(12) }}>
                      Sign Up
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      }
    />
  );
}
