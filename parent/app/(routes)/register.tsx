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
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register.tsx:43',message:'Starting registration request',data:{formData:JSON.stringify(formData)},timestamp:Date.now(),sessionId:'debug-session',runId:'register-attempt',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const response = await api.post("/parent/register", formData);
      // #region agent log
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
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'register.tsx:65',message:'Response success is false',data:{responseData:JSON.stringify(response.data)},timestamp:Date.now(),sessionId:'debug-session',runId:'register-attempt',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        Alert.alert(
          "Registration Failed",
          response.data?.message || "Registration failed"
        );
      }
    } catch (error: any) {
      // #region agent log
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
    <View style={styles.container}>
      <Text style={styles.title}>Parent Registration</Text>

      <TextInput
        style={styles.input}
        placeholder="First Name *"
        value={formData.firstName}
        onChangeText={(text) =>
          setFormData({ ...formData, firstName: text })
        }
      />

      <TextInput
        style={styles.input}
        placeholder="Last Name *"
        value={formData.lastName}
        onChangeText={(text) =>
          setFormData({ ...formData, lastName: text })
        }
      />

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        value={formData.phoneNumber}
        onChangeText={(text) =>
          setFormData({ ...formData, phoneNumber: text })
        }
        keyboardType="phone-pad"
      />

      <Text style={styles.orText}>OR</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={formData.email}
        onChangeText={(text) => setFormData({ ...formData, email: text })}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password (min 6 characters) *"
        value={formData.password}
        onChangeText={(text) => setFormData({ ...formData, password: text })}
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Register</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.linkButton}
      >
        <Text style={styles.linkText}>Already have an account? Login</Text>
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
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  orText: {
    textAlign: "center",
    color: "#6b7280",
    marginVertical: 10,
    fontWeight: "600",
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






