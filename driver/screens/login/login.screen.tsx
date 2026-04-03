import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { Toast } from "react-native-toast-notifications";
import axios from "axios";
import { getServerUri } from "@/configs/constants";
import { Ionicons } from "@expo/vector-icons";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import AuthShell from "@/components/auth/AuthShell";
import AuthBrandHeader from "@/components/auth/AuthBrandHeader";
import AuthCard from "@/components/auth/AuthCard";
import AuthPhoneField from "@/components/auth/AuthPhoneField";

export default function LoginScreen() {
  const { t } = useTranslation("auth");
  const { t: tCommon } = useTranslation("common");
  const [phone_number, setphone_number] = useState("");
  const [loading, setloading] = useState(false);
  const [countryCode, setCountryCode] = useState("20");

  const handleSubmit = async () => {
    const trimmedPhoneNumber = phone_number.trim();
    const validCountryCode =
      countryCode && countryCode !== "" ? countryCode : "20";

    if (!trimmedPhoneNumber) {
      Toast.show(t("enterPhone"), {
        placement: "bottom",
        type: "danger",
      });
      return;
    }

    if (!validCountryCode || validCountryCode === "") {
      Toast.show(t("selectCountryCode"), {
        placement: "bottom",
        type: "danger",
      });
      return;
    }

    setloading(true);
    const cleanCountryCode = (validCountryCode || "")
      .toString()
      .replace(/\+/g, "")
      .trim();
    const phoneNumber = `+${cleanCountryCode}${trimmedPhoneNumber}`;

    await axios
      .post(
        `${getServerUri()}/driver/send-otp`,
        {
          phone_number: phoneNumber,
        },
        {
          timeout: 10000,
        }
      )
      .then(() => {
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
        let errorMessage = t("genericPhoneError");

        if (
          error.code === "ECONNABORTED" ||
          error.message.includes("timeout")
        ) {
          errorMessage = t("timeoutError");
        } else if (
          error.code === "ERR_NETWORK" ||
          error.message === "Network Error"
        ) {
          errorMessage = t("networkError");
        } else if (error.response) {
          errorMessage =
            error.response.data?.message ||
            error.response.data?.error ||
            t("serverError", { status: error.response.status });
        } else if (error.request) {
          errorMessage = t("noResponseError");
        }

        Toast.show(errorMessage, {
          type: "danger",
          placement: "bottom",
          duration: 4000,
        });
      });
  };

  return (
    <AuthShell>
      <AuthBrandHeader />

      <AuthCard>
        <View style={styles.headerWrap}>
          <Text style={styles.welcomeTitle}>{t("welcomeBack")}</Text>
          <Text style={styles.welcomeSubtitle}>{t("enterPhoneSubtitle")}</Text>
        </View>

        <View style={styles.labelWrap}>
          <Text style={styles.label}>{t("phoneNumber")}</Text>
          <AuthPhoneField
            phoneNumber={phone_number}
            onPhoneNumberChange={setphone_number}
            countryCode={countryCode}
            onCountryCodeChange={setCountryCode}
          />
        </View>

        <TouchableOpacity
          style={[styles.continueButton, loading && styles.continueButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={tCommon("continue")}
        >
          {loading ? (
            <ActivityIndicator color={color.whiteColor} />
          ) : (
            <>
              <Text style={styles.continueText}>{tCommon("continue")}</Text>
              <Ionicons name="arrow-forward" size={18} color={color.whiteColor} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.modePillWrap}>
          <View style={styles.modePill}>
            <Text style={styles.modePillText}>{t("driverModeEnabled")}</Text>
          </View>
        </View>

        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>{t("noAccount")}</Text>
          <TouchableOpacity onPress={() => router.push("/(routes)/signup")}>
            <Text style={styles.signupText}>{t("signUp")}</Text>
          </TouchableOpacity>
        </View>
      </AuthCard>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    marginBottom: 22,
  },
  welcomeTitle: {
    fontFamily: fonts.bold,
    color: "#191C1D",
    fontSize: 32,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontFamily: fonts.regular,
    color: "#60636E",
    fontSize: 14,
    lineHeight: 20,
  },
  labelWrap: {
    marginBottom: 20,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#636670",
    marginBottom: 8,
    marginLeft: 2,
  },
  continueButton: {
    height: 56,
    borderRadius: 24,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueText: {
    fontFamily: fonts.bold,
    color: color.whiteColor,
    fontSize: 18,
  },
  modePillWrap: {
    alignItems: "center",
    marginTop: 18,
  },
  modePill: {
    borderRadius: 999,
    backgroundColor: "#E1E0FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modePillText: {
    fontFamily: fonts.bold,
    color: "#2F2EBE",
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  footerWrap: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    fontFamily: fonts.regular,
    color: "#60636E",
    fontSize: 13,
  },
  signupText: {
    fontFamily: fonts.bold,
    color: color.primary,
    fontSize: 13,
  },
});
