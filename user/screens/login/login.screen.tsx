import { View, Text, Image } from "react-native";
import React, { useState } from "react";
import AuthContainer from "@/utils/container/auth-container";
import { windowHeight } from "@/themes/app.constant";
import styles from "./styles";
import Images from "@/utils/images";
import SignInText from "@/components/login/signin.text";
import { external } from "@/styles/external.style";
import PhoneNumberInput from "@/components/login/phone-number.input";
import Button from "@/components/common/button";
import { router } from "expo-router";
import { useToast } from "react-native-toast-notifications";
import axios from "axios";
import { getServerUri } from "@/configs/constants";

export default function LoginScreen() {
  const [phone_number, setphone_number] = useState("");
  const [loading, setloading] = useState(false);
  const [countryCode, setCountryCode] = useState("880");
  const toast = useToast();

  const handleSubmit = async () => {
    if (phone_number === "" || countryCode === "") {
      toast.show("Please fill the fields!", {
        placement: "bottom",
      });
    } else {
      setloading(true);
      const phoneNumber = `+${countryCode}${phone_number}`;
      await axios
        .post(`${getServerUri()}/registration`, {
          phone_number: phoneNumber,
        })
        .then((res) => {
          setloading(false);
          router.push({
            pathname: "/(routes)/otp-verification",
            params: { phoneNumber },
          });
        })
        .catch((error) => {
          console.log("Registration Error:", error);
          console.log("Error Response:", error.response?.data);
          console.log("Error Status:", error.response?.status);
          console.log("Server URL:", getServerUri());
          setloading(false);
          
          let errorMessage = "Something went wrong! Please check your phone number.";
          
          if (error.response) {
            // Server responded with error
            errorMessage = error.response.data?.message || 
                          `Server error: ${error.response.status}`;
          } else if (error.request) {
            // Request was made but no response received
            errorMessage = "Cannot connect to server. Please check your internet connection and server URL.";
          } else {
            // Something else happened
            errorMessage = error.message || "An unexpected error occurred.";
          }
          
          toast.show(errorMessage, {
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
                    onPress={() => handleSubmit()}
                    disabled={loading}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      }
    />
  );
}
