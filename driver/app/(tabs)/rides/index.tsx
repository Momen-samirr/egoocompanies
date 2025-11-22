import { View, Text, ScrollView } from "react-native";
import React, { useEffect, useState } from "react";
import styles from "@/screens/home/styles";
import color from "@/themes/app.colors";
import RideCard from "@/components/ride/ride.card";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { windowHeight } from "@/themes/app.constant";
import { getServerUri } from "@/configs/constants";
import { useTheme } from "@react-navigation/native";
import { SkeletonList } from "@/components/common/LoadingSkeleton";
import EmptyState from "@/components/common/EmptyState";
import { spacing } from "@/styles/design-system";

export default function Rides() {
  const { colors } = useTheme();
  const [recentRides, setrecentRides] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const getRecentRides = async () => {
    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem("accessToken");
      const res = await axios.get(
        `${getServerUri()}/driver/get-rides`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      setrecentRides(res.data.rides || []);
    } catch (error) {
      console.error("Error fetching rides:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getRecentRides();
  }, []);

  if (loading) {
    return (
      <View
        style={[
          styles.rideContainer,
          { backgroundColor: colors.background, paddingTop: windowHeight(40) },
        ]}
      >
        <Text
          style={[
            styles.rideTitle,
            { color: colors.text, fontWeight: "600" },
          ]}
        >
          Ride History
        </Text>
        <View style={{ padding: spacing.lg }}>
          <SkeletonList count={3} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.rideContainer,
        { backgroundColor: colors.background, paddingTop: windowHeight(40) },
      ]}
    >
      <Text
        style={[
          styles.rideTitle,
          { color: colors.text, fontWeight: "600" },
        ]}
      >
        Ride History
      </Text>
      <ScrollView>
        {recentRides.length === 0 ? (
          <EmptyState
            title="No Ride History"
            message="You haven't completed any rides yet. Your ride history will appear here."
          />
        ) : (
          recentRides.map((item: any, index: number) => (
            <RideCard item={item} key={index} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
