import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import color from "@/themes/app.colors";
import { router } from "expo-router";
import AuthShell from "@/components/auth/AuthShell";
import AuthBrandHeader from "@/components/auth/AuthBrandHeader";
import AuthCard from "@/components/auth/AuthCard";
import { Ionicons } from "@expo/vector-icons";
import fonts from "@/themes/app.fonts";
import { Toast } from "react-native-toast-notifications";
import { sendSignupOtpRequest } from "@/lib/auth/sendSignupOtp";
import {
  SIGNUP_COUNTRY_NAME,
  buildEgyptSignupPhoneE164,
} from "@/lib/auth/egyptSignup";

export default function SignupScreen() {
  const { t } = useTranslation("auth");
  const [emailFormatWarning, setEmailFormatWarning] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });

  const handleChange = (key: string, value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      [key]: value,
    }));

    if (key === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value.trim() !== "" && !emailRegex.test(value)) {
        setEmailFormatWarning(t("validEmail"));
      } else {
        setEmailFormatWarning("");
      }
    }
  };

  const gotoPhoneVerification = useCallback(async () => {
    Keyboard.dismiss();

    const isNameEmpty = formData.name.trim() === "";
    const isPhoneNumberEmpty = formData.phoneNumber.trim() === "";
    const isEmailEmpty = formData.email.trim() === "";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailInvalid = !isEmailEmpty && !emailRegex.test(formData.email);

    if (
      isNameEmpty ||
      isPhoneNumberEmpty ||
      isEmailEmpty ||
      isEmailInvalid
    ) {
      setShowWarning(true);
      if (isEmailInvalid) {
        setEmailFormatWarning(t("validEmail"));
      } else {
        setEmailFormatWarning("");
      }
      return;
    }

    setShowWarning(false);
    setEmailFormatWarning("");

    const phone_number = buildEgyptSignupPhoneE164(formData.phoneNumber);
    const nationalDigits = phone_number.replace(/^\+20/, "");
    if (nationalDigits.length < 9) {
      setShowWarning(true);
      Toast.show(t("enterPhoneField"), {
        placement: "bottom",
        type: "danger",
        duration: 3000,
      });
      return;
    }

    const driverData = {
      name: formData.name,
      country: SIGNUP_COUNTRY_NAME,
      phone_number,
      email: formData.email,
    };

    setSubmitting(true);
    try {
      await sendSignupOtpRequest(phone_number);
      router.push({
        pathname: "/(routes)/verification-phone-number",
        params: driverData as Record<string, string>,
      });
    } catch (error: unknown) {
      let errorMessage = t("networkErrorShort");
      const err = error as {
        code?: string;
        message?: string;
        response?: { data?: { message?: string; error?: string }; status?: number };
        request?: unknown;
      };
      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        errorMessage = t("timeoutError");
      } else if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
        errorMessage = t("networkError");
      } else if (err.response) {
        errorMessage =
          err.response.data?.message ||
          err.response.data?.error ||
          t("serverError", { status: err.response.status ?? 0 });
      } else if (err.request) {
        errorMessage = t("noResponseError");
      }
      Toast.show(errorMessage, {
        placement: "bottom",
        type: "danger",
        duration: 4000,
      });
    } finally {
      setSubmitting(false);
    }
  }, [formData, t]);

  return (
    <AuthShell>
      <AuthBrandHeader />
      <AuthCard>
        <View style={localStyles.headerWrap}>
          <Text style={localStyles.title}>{t("createAccount")}</Text>
          <Text style={localStyles.subtitle}>{t("joinSubtitle")}</Text>
        </View>

        <Text style={localStyles.label}>{t("name")}</Text>
        <TextInput
          style={localStyles.input}
          placeholder={t("namePlaceholder")}
          placeholderTextColor="#9A9CA8"
          value={formData.name}
          onChangeText={(text) => handleChange("name", text)}
        />
        {showWarning && formData.name === "" && (
          <Text style={localStyles.warning}>{t("enterName")}</Text>
        )}

        <Text style={localStyles.label}>{t("country")}</Text>
        <View style={localStyles.countryFixed} accessibilityRole="text">
          <Text style={localStyles.countryFixedText}>{t("egypt")}</Text>
        </View>

        <Text style={localStyles.label}>{t("phoneNumber")}</Text>
        <View style={localStyles.phoneRow}>
          <View style={localStyles.dialPrefix}>
            <Text style={localStyles.dialPrefixText}>+20</Text>
          </View>
          <TextInput
            style={localStyles.phoneInput}
            placeholder={t("signupPhoneNationalHint")}
            placeholderTextColor="#9A9CA8"
            keyboardType="phone-pad"
            value={formData.phoneNumber}
            onChangeText={(text) => handleChange("phoneNumber", text)}
            accessibilityLabel={t("phoneNumber")}
          />
        </View>
        {showWarning && formData.phoneNumber.trim() === "" && (
          <Text style={localStyles.warning}>{t("enterPhoneField")}</Text>
        )}

        <Text style={localStyles.label}>{t("emailAddressLabel")}</Text>
        <TextInput
          style={localStyles.input}
          placeholder={t("placeholderEmailAddress")}
          placeholderTextColor="#9A9CA8"
          keyboardType="email-address"
          autoCapitalize="none"
          value={formData.email}
          onChangeText={(text) => handleChange("email", text)}
        />
        {showWarning && (formData.email === "" || emailFormatWarning !== "") && (
          <Text style={localStyles.warning}>
            {formData.email === "" ? t("enterEmailExclamation") : t("emailInvalidShort")}
          </Text>
        )}

        <TouchableOpacity
          style={[localStyles.button, submitting && localStyles.buttonDisabled]}
          onPress={gotoPhoneVerification}
          activeOpacity={0.9}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={localStyles.buttonText}>{t("next")}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </AuthCard>
    </AuthShell>
  );
}

const localStyles = StyleSheet.create({
  headerWrap: { marginBottom: 14 },
  title: {
    fontFamily: fonts.bold,
    color: "#191C1D",
    fontSize: 32,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.regular,
    color: "#60636E",
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#636670",
    marginBottom: 8,
    marginLeft: 2,
    marginTop: 8,
  },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#EFF1F5",
    paddingHorizontal: 14,
    color: "#1D1E26",
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  countryFixed: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#EFF1F5",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  countryFixedText: {
    color: "#1D1E26",
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dialPrefix: {
    height: 52,
    minWidth: 56,
    borderRadius: 14,
    backgroundColor: "#EFF1F5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dialPrefixText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: "#1D1E26",
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#EFF1F5",
    paddingHorizontal: 14,
    color: "#1D1E26",
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  warning: {
    color: "#BA1A1A",
    marginTop: 6,
    fontSize: 12,
  },
  button: {
    marginTop: 18,
    height: 56,
    borderRadius: 24,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: fonts.bold,
    color: "#fff",
    fontSize: 18,
  },
});
