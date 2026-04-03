import { useState } from "react";
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "@/lib/api";
import { storeParentToken, storeParentData } from "@/lib/auth";
import { Ionicons } from "@expo/vector-icons";
import AuthShell from "@/components/auth/AuthShell";
import AuthBrandHeader from "@/components/auth/AuthBrandHeader";
import AuthCard from "@/components/auth/AuthCard";
import AuthInput from "@/components/auth/AuthInput";

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!verificationCode) {
      Alert.alert("Error", "Please enter verification code");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/parent/verify", {
        phoneNumber: params.phoneNumber || undefined,
        email: params.email || undefined,
        verificationCode,
      });

      if (response.data.success) {
        await storeParentToken(response.data.accessToken);
        await storeParentData(response.data.user);
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      Alert.alert(
        "Verification Failed",
        error.response?.data?.message || "Invalid verification code"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthBrandHeader />
      <AuthCard>
        <View style={styles.headerWrap}>
          <Text style={styles.title}>Verify Account</Text>
          <Text style={styles.subtitle}>
            Enter the verification code sent to {params.phoneNumber || params.email}
          </Text>
        </View>

        <AuthInput
          style={styles.input}
          placeholder="Verification Code"
          value={verificationCode}
          onChangeText={setVerificationCode}
          keyboardType="number-pad"
          maxLength={6}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Verify</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </AuthCard>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 6,
    color: "#191C1D",
  },
  subtitle: {
    fontSize: 14,
    color: "#60636E",
    lineHeight: 20,
    marginBottom: 16,
  },
  input: {
    textAlign: "center",
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: "700",
  },
  button: {
    backgroundColor: "#494BD6",
    height: 56,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});







