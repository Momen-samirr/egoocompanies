import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getParentToken, getParentData } from "@/lib/auth";

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getParentToken();
      const parent = await getParentData();

      if (token && parent) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(routes)/login");
      }
    } catch (error) {
      router.replace("/(routes)/login");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return null;
}







