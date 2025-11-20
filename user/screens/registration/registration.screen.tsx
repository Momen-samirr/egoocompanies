import { View, Text, ScrollView, StyleSheet } from "react-native";
import React, { useState } from "react";
import { useTheme } from "@react-navigation/native";
import { windowHeight, windowWidth } from "@/themes/app.constant";
import TitleView from "@/components/signup/title.view";
import Input from "@/components/common/input";
import Button from "@/components/common/button";
import color from "@/themes/app.colors";
import { router, useLocalSearchParams } from "expo-router";
import axios from "axios";
import { useToast } from "react-native-toast-notifications";
import { getServerUri } from "@/configs/constants";

export default function RegistrationScreen() {
  const { colors } = useTheme();
  const { user } = useLocalSearchParams() as any;
  const parsedUser = JSON.parse(user);
  const [emailFormatWarning, setEmailFormatWarning] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleChange = (key: string, value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      [key]: value,
    }));
  };
  

  const handleSubmit = async () => {
    // Validate form data
    if (!formData.name || !formData.email) {
      toast.show("Please fill in all fields!", {
        type: "danger",
        placement: "bottom",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.show("Please enter a valid email address!", {
        type: "danger",
        placement: "bottom",
      });
      return;
    }

    setLoading(true);
    await axios
      .post(`${getServerUri()}/email-otp-request`, {
        email: formData.email,
        name: formData.name,
        userId: parsedUser.id,
      }) 
      .then((res) => {
        setLoading(false);
        const userData: any = {
          id: parsedUser.id,
          name: formData.name,
          email: formData.email,
          phone_number: parsedUser.phone_number,
          token: res.data.token,
        };
        router.push({
          pathname: "/(routes)/email-verification",
          params: { user: JSON.stringify(userData) },
        });
      })
      .catch((error) => {
        setLoading(false);
        console.log("Email OTP Error:", error);
        console.log("Error Response:", error.response?.data);
        
        let errorMessage = "Failed to send verification email. Please try again.";
        
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response) {
          errorMessage = `Server error: ${error.response.status}`;
        } else if (error.request) {
          errorMessage = "Cannot connect to server. Please check your connection.";
        }
        
        toast.show(errorMessage, {
          type: "danger",
          placement: "bottom",
          duration: 4000,
        });
      });
  };

  return (
    <ScrollView>
      <View>
        {/* logo */}
        <Text
          style={{
            fontFamily: "TT-Octosquares-Medium",
            fontSize: windowHeight(25),
            paddingTop: windowHeight(50),
            textAlign: "center",
          }}
        >
          Egoo
        </Text>
        <View style={{ padding: windowWidth(20) }}>
          <View
            style={[styles.subView, { backgroundColor: colors.background }]}
          >
            <View style={styles.space}>
              <TitleView
                title={"Create your account"}
                subTitle="Explore your life by joining Egoo"
              />
              <Input
                title="Name"
                placeholder="Enter your name"
                value={formData?.name}
                onChangeText={(text) => handleChange("name", text)}
                showWarning={showWarning && formData.name === ""}
                warning={"Please enter your name!"}
              />
              <Input
                title="Phone Number"
                placeholder="Enter your phone number"
                value={parsedUser?.phone_number}
                disabled={true}
              />
              <Input
                title="Email Address"
                placeholder="Enter your email address"
                keyboardType="email-address"
                value={formData.email}
                onChangeText={(text) => handleChange("email", text)}
                showWarning={
                  (showWarning && formData.name === "") ||
                  emailFormatWarning !== ""
                }
                warning={
                  emailFormatWarning !== ""
                    ? "Please enter your email!"
                    : "Please enter a validate email!"
                }
                emailFormatWarning={emailFormatWarning}
              />
              <View style={styles.margin}>
                <Button
                  onPress={() => handleSubmit()}
                  title="Next"
                  disabled={loading}
                  backgroundColor={color.buttonBg}
                  textColor={color.whiteColor}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
  },
  subView: {
    height: "100%",
  },
  space: {
    marginHorizontal: windowWidth(4),
  },
  margin: {
    marginVertical: windowHeight(12),
  },
});
