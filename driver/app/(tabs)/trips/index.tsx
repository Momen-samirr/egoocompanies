import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import React, { useEffect, useState } from "react";
import styles from "@/screens/home/styles";
import color from "@/themes/app.colors";
import ScheduledTripCard from "@/components/trip/scheduled-trip.card";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { windowHeight } from "@/themes/app.constant";
import { getServerUri } from "@/configs/constants";
import { useTheme } from "@react-navigation/native";

export default function ScheduledTripsHistory() {
  const { colors } = useTheme();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const getScheduledTrips = async () => {
    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        return;
      }

      const response = await axios.get(
        `${getServerUri()}/driver/scheduled-trips`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        // Get all trips (not just scheduled ones)
        setTrips(response.data.trips);
      }
    } catch (error: any) {
      console.error("Error fetching scheduled trips:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getScheduledTrips();
  }, []);

  if (loading) {
    return (
      <View
        style={[
          styles.rideContainer,
          {
            backgroundColor: color.lightGray,
            paddingTop: windowHeight(40),
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={color.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.rideContainer,
        { backgroundColor: color.lightGray, paddingTop: windowHeight(40) },
      ]}
    >
      <Text
        style={[
          styles.rideTitle,
          { color: color.primaryText, fontWeight: "600" },
        ]}
      >
        Scheduled Trips History
      </Text>
      <ScrollView>
        {trips.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              marginTop: windowHeight(50),
              padding: 20,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>
              No scheduled trips found
            </Text>
          </View>
        ) : (
          trips.map((item: any, index: number) => (
            <ScheduledTripCard item={item} key={item.id || index} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

