import { useState } from "react";
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import api from "@/lib/api";
import { storeParentToken, storeParentData } from "@/lib/auth";
import { Ionicons } from "@expo/vector-icons";
import AuthShell from "@/components/auth/AuthShell";
import AuthBrandHeader from "@/components/auth/AuthBrandHeader";
import AuthCard from "@/components/auth/AuthCard";
import AuthModeToggle from "@/components/auth/AuthModeToggle";
import AuthInput from "@/components/auth/AuthInput";

export default function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePhone, setUsePhone] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if ((!phoneNumber && usePhone) || (!email && !usePhone) || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/parent/login", {
        phoneNumber: usePhone ? phoneNumber : undefined,
        email: usePhone ? undefined : email,
        password,
      });

      if (response.data.success) {
        await storeParentToken(response.data.accessToken);
        await storeParentData(response.data.user);
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      Alert.alert(
        "Login Failed",
        error.response?.data?.message || "Invalid credentials"
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
          <Text style={styles.welcomeTitle}>Welcome Back</Text>
          <Text style={styles.welcomeSubtitle}>
            Sign in to track trips and manage student transportation
          </Text>
        </View>

        <AuthModeToggle usePhone={usePhone} onChange={setUsePhone} />

        {usePhone ? (
          <AuthInput
            placeholder="Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        ) : (
          <AuthInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        )}

        <AuthInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.modePillWrap}>
          <View style={styles.modePill}>
            <Text style={styles.modePillText}>Parent Mode Enabled</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(routes)/register")}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </AuthCard>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#191C1D",
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#60636E",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#494BD6",
    height: 56,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.7,
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
    color: "#2F2EBE",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  linkButton: {
    marginTop: 20,
    alignItems: "center",
  },
  linkText: {
    color: "#494BD6",
    fontSize: 13,
    fontWeight: "600",
  },
});







