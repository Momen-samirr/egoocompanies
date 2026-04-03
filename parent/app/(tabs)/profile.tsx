import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getParentData, removeParentToken, removeParentData } from "@/lib/auth";
import AuthShell from "@/components/auth/AuthShell";
import AuthBrandHeader from "@/components/auth/AuthBrandHeader";
import AuthCard from "@/components/auth/AuthCard";

export default function ProfileScreen() {
  const router = useRouter();
  const [parent, setParent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadParentData();
  }, []);

  const loadParentData = async () => {
    try {
      const data = await getParentData();
      setParent(data);
    } catch (error) {
      console.error("Error loading parent data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await removeParentToken();
          await removeParentData();
          router.replace("/(routes)/login");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <AuthShell>
      <AuthBrandHeader title="Parent Profile" subtitle="Manage your account settings" />
      <AuthCard>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#494BD6" />
          </View>
          <Text style={styles.name}>
            {parent?.firstName} {parent?.lastName}
          </Text>
          <Text style={styles.email}>{parent?.email || parent?.phoneNumber}</Text>
        </View>

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={22} color="#374151" />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={22} color="#374151" />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#BA1A1A" />
            <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </AuthCard>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingVertical: 8,
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E1E0FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#191C1D",
    marginBottom: 5,
  },
  email: {
    fontSize: 14,
    color: "#60636E",
  },
  menu: {
    marginTop: 18,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#EFF1F5",
    marginBottom: 10,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    marginLeft: 12,
  },
  logoutItem: { backgroundColor: "#FEE7E7" },
  logoutText: {
    color: "#BA1A1A",
  },
});







