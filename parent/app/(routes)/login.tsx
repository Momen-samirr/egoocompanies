import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import api from "@/lib/api";
import { storeParentToken, storeParentData } from "@/lib/auth";

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
    <View style={styles.container}>
      <Text style={styles.title}>Parent Login</Text>

      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggle, usePhone && styles.toggleActive]}
          onPress={() => setUsePhone(true)}
        >
          <Text style={[styles.toggleText, usePhone && styles.toggleTextActive]}>
            Phone
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, !usePhone && styles.toggleActive]}
          onPress={() => setUsePhone(false)}
        >
          <Text style={[styles.toggleText, !usePhone && styles.toggleTextActive]}>
            Email
          </Text>
        </TouchableOpacity>
      </View>

      {usePhone ? (
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          autoCapitalize="none"
        />
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(routes)/register")}
        style={styles.linkButton}
      >
        <Text style={styles.linkText}>
          Don't have an account? Register
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
    color: "#1f2937",
  },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 4,
  },
  toggle: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: "#6366f1",
  },
  toggleText: {
    color: "#6b7280",
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#6366f1",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 20,
    alignItems: "center",
  },
  linkText: {
    color: "#6366f1",
    fontSize: 14,
  },
});







