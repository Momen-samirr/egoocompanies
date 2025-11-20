import { View, Text, ScrollView } from "react-native";
import React, { useState } from "react";
import { windowHeight, windowWidth } from "@/themes/app.constant";
import ProgressBar from "@/components/common/progress.bar";
import styles from "../signup/styles";
import { useTheme } from "@react-navigation/native";
import TitleView from "@/components/signup/title.view";
import Input from "@/components/common/input";
import SelectInput from "@/components/common/select-input";
import Button from "@/components/common/button";
import color from "@/themes/app.colors";
import { router, useLocalSearchParams } from "expo-router";
import axios from "axios";
import { Toast } from "react-native-toast-notifications";
import { getServerUri } from "@/configs/constants";

export default function DocumentVerificationScreen() {
  const driverData = useLocalSearchParams();
  const { colors } = useTheme();
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vehicleType: "Car",
    registrationNumber: "",
    registrationDate: "",
    drivingLicenseNumber: "",
    color: "",
    rate: "",
  });

  const handleChange = (key: string, value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      [key]: value,
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const driver = {
      ...driverData,
      vehicle_type: formData.vehicleType,
      registration_number: formData.registrationNumber,
      registration_date: formData.registrationDate,
      driving_license: formData.drivingLicenseNumber,
      vehicle_color: formData.color,
      rate: formData.rate,
    };

    // Ensure phone_number has + prefix but avoid double prefixing
    const phoneNumber = driverData.phone_number?.toString().startsWith('+') 
      ? driverData.phone_number.toString() 
      : `+${driverData.phone_number}`;

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
        router.push({
          pathname: "/(routes)/verification-phone-number",
          params: driver,
        });
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        console.error('Error sending OTP:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          status: error.response?.status,
          serverUri: getServerUri(),
        });

        // Provide more helpful error messages
        let errorMessage = "Network Error";
        
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
          placement: "bottom",
          type: "danger",
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
            fontSize: windowHeight(22),
            paddingTop: windowHeight(50),
            textAlign: "center",
          }}
        >
          Egoo
        </Text>
        <View style={{ padding: windowWidth(20) }}>
          <ProgressBar fill={2} />
          <View
            style={[styles.subView, { backgroundColor: colors.background }]}
          >
            <View style={styles.space}>
              <TitleView
                title={"Vehicle Registration"}
                subTitle={"Explore your life by joining Egoo"}
              />
              <SelectInput
                title="Vehicle Type"
                placeholder="Choose your vehicle type"
                value={formData.vehicleType}
                onValueChange={(text) => handleChange("vehicleType", text)}
                showWarning={showWarning && formData.vehicleType === ""}
                warning={"Please choose your vehicle type!"}
                items={[
                  { label: "Car", value: "Car" },
                  { label: "Motorcycle", value: "Motorcycle" },
                  { label: "cng", value: "cng" },
                ]}
              />
              <Input
                title="Registration Number"
                placeholder="Enter your vehicle registration number"
                keyboardType="number-pad"
                value={formData.registrationNumber}
                onChangeText={(text) =>
                  handleChange("registrationNumber", text)
                }
                showWarning={showWarning && formData.registrationNumber === ""}
                warning={"Please enter your vehicle registration number!"}
              />
              <Input
                title="Vehicle Registration Date"
                placeholder="Enter your vehicle registration date"
                value={formData.registrationDate}
                onChangeText={(text) => handleChange("registrationDate", text)}
                showWarning={showWarning && formData.registrationDate === ""}
                warning={"Please enter your vehicle Registration Date number!"}
              />
              <Input
                title={"Driving License Number"}
                placeholder={"Enter your driving license number"}
                keyboardType="number-pad"
                value={formData.drivingLicenseNumber}
                onChangeText={(text) =>
                  handleChange("drivingLicenseNumber", text)
                }
                showWarning={
                  showWarning && formData.drivingLicenseNumber === ""
                }
                warning={"Please enter your driving license number!"}
              />
              <Input
                title={"Vehicle Color"}
                placeholder={"Enter your vehicle color"}
                value={formData.color}
                onChangeText={(text) => handleChange("color", text)}
                showWarning={showWarning && formData.color === ""}
                warning={"Please enter your vehicle color!"}
              />
              <Input
                title={"Rate per km"}
                placeholder={
                  "How much you want to charge from your passenger per km."
                }
                keyboardType="number-pad"
                value={formData.rate}
                onChangeText={(text) => handleChange("rate", text)}
                showWarning={showWarning && formData.rate === ""}
                warning={
                  "Please enter how much you want to charge from your customer per km."
                }
              />
            </View>
            <View style={styles.margin}>
              <Button
                onPress={() => handleSubmit()}
                title={"Submit"}
                height={windowHeight(30)}
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
