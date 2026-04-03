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
import AuthShell from "@/components/auth/AuthShell";
import AuthBrandHeader from "@/components/auth/AuthBrandHeader";
import AuthCard from "@/components/auth/AuthCard";
import AuthInput from "@/components/auth/AuthInput";
import { Ionicons } from "@expo/vector-icons";

export default function RegisterScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    phoneNumber: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (
      (!formData.phoneNumber && !formData.email) ||
      !formData.firstName ||
      !formData.lastName ||
      !formData.password
    ) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      // #region agent log
      console.log('[DEBUG] Starting registration request:', formData);
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register.tsx:43',message:'Starting registration request',data:{formData:JSON.stringify(formData)},timestamp:Date.now(),sessionId:'debug-session',runId:'register-attempt',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const response = await api.post("/parent/register", formData);
      // #region agent log
      console.log('[DEBUG] Registration response received:', { status: response.status, success: response.data?.success, message: response.data?.message, fullResponse: response.data });
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register.tsx:46',message:'Registration response received',data:{status:response.status,success:response.data?.success,message:response.data?.message,fullResponse:JSON.stringify(response.data)},timestamp:Date.now(),sessionId:'debug-session',runId:'register-attempt',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (response.data.success) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register.tsx:48',message:'Registration successful branch',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'register-attempt',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        Alert.alert(
          "Success",
          "Registration successful! Please verify your account.",
          [
            {
              text: "OK",
              onPress: () =>
                router.push({
                  pathname: "/(routes)/verify",
                  params: {
                    phoneNumber: formData.phoneNumber,
                    email: formData.email,
                  },
                }),
            },
          ]
        );
      } else {
        // #region agent log
        console.log('[DEBUG] Response success is false:', response.data);
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register.tsx:65',message:'Response success is false',data:{responseData:JSON.stringify(response.data)},timestamp:Date.now(),sessionId:'debug-session',runId:'register-attempt',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        Alert.alert(
          "Registration Failed",
          response.data?.message || "Registration failed"
        );
      }
    } catch (error: any) {
      // #region agent log
      console.error('[DEBUG] Registration error caught:', { 
        errorMessage: error?.message, 
        errorResponse: error?.response?.data, 
        errorStatus: error?.response?.status, 
        errorStatusText: error?.response?.statusText,
        errorCode: error?.code,
        fullError: error 
      });
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register.tsx:72',message:'Registration error caught',data:{errorMessage:error?.message,errorResponse:error?.response?.data?JSON.stringify(error.response.data):'no response',errorStatus:error?.response?.status,errorStatusText:error?.response?.statusText,fullError:JSON.stringify(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'register-attempt',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      Alert.alert(
        "Registration Failed",
        error.response?.data?.message || error.message || "Registration failed"
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
          <Text style={styles.title}>Create Parent Account</Text>
          <Text style={styles.subtitle}>Register to manage and track your student rides</Text>
        </View>

        <AuthInput
          placeholder="First Name *"
          value={formData.firstName}
          onChangeText={(text) => setFormData({ ...formData, firstName: text })}
        />

        <AuthInput
          placeholder="Last Name *"
          value={formData.lastName}
          onChangeText={(text) => setFormData({ ...formData, lastName: text })}
        />

        <AuthInput
          placeholder="Phone Number"
          value={formData.phoneNumber}
          onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
          keyboardType="phone-pad"
        />

        <Text style={styles.orText}>OR</Text>

        <AuthInput
          placeholder="Email"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <AuthInput
          placeholder="Password (min 6 characters) *"
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Register</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.linkButton}>
          <Text style={styles.linkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </AuthCard>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    marginBottom: 14,
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
  },
  orText: {
    textAlign: "center",
    color: "#8D90A0",
    marginVertical: 8,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#494BD6",
    height: 56,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
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






