import { View, Text, Linking, ScrollView, TouchableOpacity, Platform } from "react-native";
import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import color from "@/themes/app.colors";
import Button from "@/components/common/button";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Toast } from "react-native-toast-notifications";
import { getServerUri } from "@/configs/constants";
import { useTheme } from "@react-navigation/native";
import PassengerCard from "@/components/ride/PassengerCard";
import ETADisplay from "@/components/common/ETADisplay";
import StatusBadge from "@/components/common/StatusBadge";
import { spacing, shadows } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import Header from "@/components/common/header";
import { useGetDriverData } from "@/hooks/useGetDriverData";

export default function RideDetailsScreen() {
  const { colors } = useTheme();
  const { driver } = useGetDriverData();
  const { orderData: orderDataObj } = useLocalSearchParams() as any;
  const [orderStatus, setorderStatus] = useState("Processing");
  const [isOnline, setIsOnline] = useState(false);
  const orderData = JSON.parse(orderDataObj);
  const [region, setRegion] = useState<any>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    checkOnlineStatus();
  }, []);

  const checkOnlineStatus = async () => {
    try {
      const status = await AsyncStorage.getItem("status");
      setIsOnline(status === "active");
    } catch (error) {
      console.error("Error checking online status:", error);
    }
  };

  useEffect(() => {
    if (orderData?.currentLocation && orderData?.marker) {
      const latitudeDelta =
        Math.abs(
          orderData.marker.latitude - orderData.currentLocation.latitude
        ) * 2;
      const longitudeDelta =
        Math.abs(
          orderData.marker.longitude - orderData.currentLocation.longitude
        ) * 2;

      setRegion({
        latitude:
          (orderData.marker.latitude + orderData.currentLocation.latitude) / 2,
        longitude:
          (orderData.marker.longitude + orderData.currentLocation.longitude) /
          2,
        latitudeDelta: Math.max(latitudeDelta, 0.0922),
        longitudeDelta: Math.max(longitudeDelta, 0.0421),
      });
      setorderStatus(orderData.rideData.status);
    }
  }, []);

  const handleSubmit = async () => {
    const accessToken = await AsyncStorage.getItem("accessToken");
    await axios
      .put(
        `${getServerUri()}/driver/update-ride-status`,
        {
          rideStatus: orderStatus === "Ongoing" ? "Completed" : "Ongoing",
          rideId: orderData?.rideData.id,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
      .then((res) => {
        if (res.data.updatedRide.status === "Ongoing") {
          setorderStatus(res.data.updatedRide.status);
          Toast.show("Let's have a safe journey!", {
            type: "success",
          });
        } else {
          Toast.show(`Well done ${orderData.driver.name}`);
          router.push("/(tabs)/home");
        }
      })
      .catch((error) => {
        console.log(error);
        Toast.show("Failed to update ride status", { type: "danger" });
      });
  };

  const openNavigation = () => {
    const destination = orderData?.marker;
    if (!destination) return;

    const { latitude, longitude } = destination;
    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${latitude},${longitude}`;
    const label = orderData?.destinationLocationName || "Destination";
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback to Google Maps web
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
      });
    }
  };

  const estimatedDistance = orderData?.distance ? parseFloat(orderData.distance) : 0;
  const estimatedFare = estimatedDistance * parseInt(orderData?.driver?.rate || "0");

  const getStatusBadgeType = () => {
    switch (orderStatus) {
      case "Processing":
        return "scheduled";
      case "Ongoing":
        return "active";
      case "Completed":
        return "completed";
      default:
        return "scheduled";
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header isOn={isOnline} toggleSwitch={() => {}} showBackButton={true} title="Ride Details" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map View */}
        <View style={{ height: windowHeight(350), borderRadius: 0 }}>
          <MapView
            style={{ flex: 1 }}
            region={region}
            onRegionChangeComplete={(region) => setRegion(region)}
            showsUserLocation={true}
          >
            {orderData?.marker && (
              <Marker
                coordinate={orderData?.marker}
                title="Destination"
                pinColor={color.status.active}
              />
            )}
            {orderData?.currentLocation && (
              <Marker
                coordinate={orderData?.currentLocation}
                title="Pickup"
                pinColor={color.status.completed}
              />
            )}
            {orderData?.currentLocation && orderData?.marker && (
              <MapViewDirections
                origin={orderData?.currentLocation}
                destination={orderData?.marker}
                apikey={process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY!}
                strokeWidth={4}
                strokeColor={color.primary}
              />
            )}
          </MapView>
        </View>

        <View style={{ padding: spacing.lg }}>
          {/* Status Badge */}
          <View style={{ marginBottom: spacing.lg }}>
            <StatusBadge status={getStatusBadgeType()} size="lg" />
          </View>

          {/* Passenger Card */}
          {orderData?.user && (
            <View style={{ marginBottom: spacing.lg }}>
              <PassengerCard passenger={orderData.user} />
            </View>
          )}

          {/* Ride Information Card */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: spacing.lg,
              marginBottom: spacing.lg,
              ...shadows.sm,
            }}
          >
            <Text
              style={{
                fontSize: fontSizes.FONT18,
                fontFamily: fonts.bold,
                color: colors.text,
                marginBottom: spacing.md,
              }}
            >
              Ride Information
            </Text>

            {/* Locations */}
            <View style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: "row", marginBottom: spacing.sm }}>
                <View style={{ width: 20, alignItems: "center", marginRight: spacing.sm }}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: color.status.completed,
                    }}
                  />
                  <View
                    style={{
                      width: 2,
                      flex: 1,
                      backgroundColor: color.border,
                      marginTop: spacing.xs,
                    }}
                  />
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: color.status.active,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSizes.FONT14,
                      fontFamily: fonts.medium,
                      color: color.text.secondary,
                      marginBottom: spacing.xs / 2,
                    }}
                  >
                    Pickup
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSizes.FONT16,
                      fontFamily: fonts.regular,
                      color: colors.text,
                      marginBottom: spacing.md,
                    }}
                    numberOfLines={2}
                  >
                    {orderData?.currentLocationName || "Pickup Location"}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSizes.FONT14,
                      fontFamily: fonts.medium,
                      color: color.text.secondary,
                      marginBottom: spacing.xs / 2,
                    }}
                  >
                    Destination
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSizes.FONT16,
                      fontFamily: fonts.regular,
                      color: colors.text,
                    }}
                    numberOfLines={2}
                  >
                    {orderData?.destinationLocationName || "Destination"}
                  </Text>
                </View>
              </View>
            </View>

            {/* ETA and Distance */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                marginBottom: spacing.md,
              }}
            >
              <ETADisplay distance={estimatedDistance} size="md" />
            </View>

            {/* Fare Information */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: fontSizes.FONT16,
                  fontFamily: fonts.medium,
                  color: color.text.secondary,
                }}
              >
                Estimated Fare
              </Text>
              <Text
                style={{
                  fontSize: fontSizes.FONT24,
                  fontFamily: fonts.bold,
                  color: color.primary,
                }}
              >
                {estimatedFare.toFixed(2)} BDT
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: spacing.md }}>
            <TouchableOpacity
              onPress={openNavigation}
              style={{
                backgroundColor: colors.card,
                padding: spacing.md,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, marginRight: spacing.sm }}>🧭</Text>
              <Text
                style={{
                  fontSize: fontSizes.FONT16,
                  fontFamily: fonts.medium,
                  color: colors.text,
                }}
              >
                Open in Maps
              </Text>
            </TouchableOpacity>

            <Button
              title={
                orderStatus === "Processing"
                  ? "Pick Up Passenger"
                  : orderStatus === "Ongoing"
                  ? "Complete Ride"
                  : "Ride Completed"
              }
              height={windowHeight(50)}
              disabled={orderStatus === "Completed"}
              backgroundColor={
                orderStatus === "Completed"
                  ? color.border
                  : orderStatus === "Processing"
                  ? color.status.completed
                  : color.primary
              }
              onPress={() => handleSubmit()}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
