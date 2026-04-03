import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { router, useLocalSearchParams } from "expo-router";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import axios from "axios";
import { Toast } from "react-native-toast-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getServerUri } from "@/configs/constants";
import AuthShell from "@/components/auth/AuthShell";
import AuthCard from "@/components/auth/AuthCard";
import { Ionicons } from "@expo/vector-icons";
import OtpCellRow from "@/components/kinetic/OtpCellRow";
import KineticPrimaryButton from "@/components/kinetic/KineticPrimaryButton";

export default function PhoneNumberVerificationScreen() {
  const { t } = useTranslation("auth");
  const driver = useLocalSearchParams();
  const [otp, setOtp] = useState("");
  const [loader, setLoader] = useState(false);

  const handleSubmit = async () => {
    const otpToUse = otp;

    if (otpToUse === "") {
      Toast.show(t("fillFields"), {
        placement: "bottom",
      });
      return;
    }

    // Trim and clean the OTP to remove any whitespace
    const otpNumbers = otpToUse.trim().replace(/\s+/g, "");

    if (otpNumbers.length !== 4) {
      Toast.show(t("validOtp"), {
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
          const errorMessage =
            error.response?.data?.message || t("otpIncorrect");
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
          const errorMessage =
            error.response?.data?.message || t("otpIncorrect");
          Toast.show(errorMessage, {
            placement: "bottom",
            type: "danger",
            duration: 4000,
          });
        });
    }
  };
  return (
    <AuthShell>
      <AuthCard>
        <View style={styles.headerWrap}>
          <Text style={styles.title}>{t("verifyPhoneTitle")}</Text>
          <Text style={styles.subtitle}>
            {t("verifyPhoneSubtitle", {
              phone: driver.phone_number || t("yourPhoneFallback"),
            })}
          </Text>
        </View>

        <OtpCellRow value={otp} onChangeText={setOtp} />

        <View style={styles.verifyButton}>
          <KineticPrimaryButton
            title={t("verifyAndContinue")}
            loading={loader}
            onPress={handleSubmit}
            icon={<Ionicons name="arrow-forward" size={18} color="#fff" />}
          />
        </View>

        <View style={styles.resendWrap}>
          <Text style={styles.resendHint}>{t("resendHint")}</Text>
          <TouchableOpacity>
            <Text style={styles.resendLink}>{t("resendLink")}</Text>
          </TouchableOpacity>
        </View>
      </AuthCard>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: "#191C1D",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#60636E",
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  verifyButton: {
    marginTop: 18,
  },
  resendWrap: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  resendHint: {
    color: "#464554",
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  resendLink: {
    color: color.primary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
