import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { router, useLocalSearchParams } from "expo-router";
import color from "@/themes/app.colors";
import { Toast } from "react-native-toast-notifications";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getServerUri } from "@/configs/constants";
import AuthShell from "@/components/auth/AuthShell";
import AuthBrandHeader from "@/components/auth/AuthBrandHeader";
import AuthCard from "@/components/auth/AuthCard";
import { Ionicons } from "@expo/vector-icons";
import fonts from "@/themes/app.fonts";

export default function EmailVerificationScreen() {
  const { t } = useTranslation("auth");
  const [otp, setOtp] = useState("");
  const [loader, setLoader] = useState(false);
  const driver = useLocalSearchParams() as any;

  const toSerializableParams = () => {
    const serialized: Record<string, string> = {};
    Object.entries(driver || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      serialized[key] = Array.isArray(value)
        ? String(value[0] || "")
        : String(value);
    });
    return serialized;
  };

  const handleSubmit = async () => {
    setLoader(true);
    const otpNumbers = `${otp}`;
    await axios
      .post(`${getServerUri()}/driver/registration-driver`, {
        token: driver.token,
        otp: otpNumbers,
      })
      .then(async (res: any) => {
        setLoader(false);
        await AsyncStorage.setItem("accessToken", res.data.accessToken);
        router.push({
          pathname: "/(routes)/driver-upload-selfie",
          params: toSerializableParams(),
        });
      })
      .catch((error) => {
        setLoader(false);
        Toast.show(error.message, {
          placement: "bottom",
          type: "danger",
        });
      });
  };

  return (
    <AuthShell>
      <AuthBrandHeader />
      <AuthCard>
        <View style={styles.headerWrap}>
          <Text style={styles.title}>{t("emailVerificationTitle")}</Text>
          <Text style={styles.subtitle}>{t("emailOtpSubtitle")}</Text>
        </View>

        <TextInput
          style={styles.otpInput}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={4}
          placeholder={t("otpPlaceholder")}
          placeholderTextColor="#A0A2AD"
          textAlign="center"
        />

        <TouchableOpacity
          style={[styles.verifyButton, loader && styles.verifyButtonDisabled]}
          onPress={handleSubmit}
          disabled={loader}
          activeOpacity={0.9}
        >
          {loader ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.verifyText}>{t("verifyEmailButton")}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.resendWrap}>
          <Text style={styles.resendHint}>{t("emailResendHint")}</Text>
          <TouchableOpacity>
            <Text style={styles.resendLink}>{t("emailResendLink")}</Text>
          </TouchableOpacity>
        </View>
      </AuthCard>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    marginBottom: 18,
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
  otpInput: {
    height: 62,
    borderRadius: 16,
    backgroundColor: "#EFF1F5",
    color: "#1D1E26",
    fontSize: 26,
    letterSpacing: 12,
    fontFamily: fonts.bold,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  verifyButton: {
    height: 56,
    borderRadius: 24,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: fonts.bold,
  },
  resendWrap: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  resendHint: {
    color: "#636670",
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  resendLink: {
    color: color.primary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
