import { View, Text, Linking, Platform } from "react-native";
import React, { useEffect, useState, useRef } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import color from "@/themes/app.colors";
import { Toast } from "react-native-toast-notifications";
import { getWebSocketUrl } from "@/configs/constants";

export default function RideDetailsScreen() {
  const { orderData: orderDataObj } = useLocalSearchParams() as any;
  const orderData = JSON.parse(orderDataObj);
  const ws = useRef<any>(null);
  const [region, setRegion] = useState<any>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    if (orderData?.driver?.currentLocation && orderData?.driver?.marker) {
      const latitudeDelta =
        Math.abs(
          orderData.driver.marker.latitude -
            orderData.driver.currentLocation.latitude
        ) * 2;
      const longitudeDelta =
        Math.abs(
          orderData.driver.marker.longitude -
            orderData.driver.currentLocation.longitude
        ) * 2;

      setRegion({
        latitude:
          (orderData.driver.marker.latitude +
            orderData.driver.currentLocation.latitude) /
          2,
        longitude:
          (orderData.driver.marker.longitude +
            orderData.driver.currentLocation.longitude) /
          2,
        latitudeDelta: Math.max(latitudeDelta, 0.0922),
        longitudeDelta: Math.max(longitudeDelta, 0.0421),
      });
    }
  }, []);

  // Set up WebSocket to listen for ride completion
  useEffect(() => {
    const initializeWebSocket = () => {
      const wsUrl = getWebSocketUrl();
      console.log(`[RideDetails] Connecting to WebSocket: ${wsUrl}`);
      
      try {
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log("[RideDetails] WebSocket connected");
          // Register user to receive ride updates
          if (orderData?.rideData?.userId && ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(
              JSON.stringify({
                type: "registerUser",
                role: "user",
                userId: orderData.rideData.userId,
              })
            );
          }
        };

        ws.current.onmessage = (e: any) => {
          try {
            if (!e.data || typeof e.data !== 'string') {
              return;
            }

            const trimmed = e.data.trim();
            if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
              return;
            }

            const message = JSON.parse(e.data);
            console.log("[RideDetails] Received WebSocket message:", message.type);

            if (message.type === "rideCompleted") {
              // Driver completed the trip - navigate to home
              console.log("✅ Ride completed by driver!");
              Toast.show("Trip completed! Thank you for using our service.", {
                type: "success",
                placement: "bottom",
                duration: 3000,
              });

              // Navigate to home after a short delay
              setTimeout(() => {
                router.replace("/(tabs)/home");
              }, 2000);
            } else if (message.type === "rideStatusUpdate") {
              // Handle other ride status updates if needed
              console.log("[RideDetails] Ride status updated:", message.status);
            }
          } catch (error: any) {
            console.log("[RideDetails] Error parsing websocket message:", error);
          }
        };

        ws.current.onerror = (e: any) => {
          console.log("[RideDetails] WebSocket error:", e.message);
        };

        ws.current.onclose = (e: any) => {
          console.log("[RideDetails] WebSocket closed:", e.code, e.reason);
          // Attempt to reconnect after a delay
          setTimeout(() => {
            initializeWebSocket();
          }, 5000);
        };
      } catch (error) {
        console.error("[RideDetails] Failed to create WebSocket:", error);
      }
    };

    initializeWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [orderData?.rideData?.userId]);

  return (
    <View>
      <View style={{ height: windowHeight(450) }}>
        <MapView
          style={{ flex: 1 }}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          region={region}
          onRegionChangeComplete={(region) => setRegion(region)}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          {orderData?.driver?.marker && (
            <Marker coordinate={orderData?.driver?.marker} />
          )}
          {orderData?.driver?.currentLocation && (
            <Marker coordinate={orderData?.driver?.currentLocation} />
          )}
          {orderData?.driver?.currentLocation && orderData?.driver?.marker && (
            <MapViewDirections
              origin={orderData?.driver?.currentLocation}
              destination={orderData?.driver?.marker}
              apikey={process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY!}
              strokeWidth={4}
              strokeColor="blue"
            />
          )}
        </MapView>
      </View>
      <View style={{ padding: windowWidth(20) }}>
        <Text
          style={{
            fontSize: fontSizes.FONT20,
            fontWeight: "500",
            paddingVertical: windowHeight(5),
          }}
        >
          Driver Name: {orderData?.driver?.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              fontSize: fontSizes.FONT20,
              fontWeight: "500",
              paddingVertical: windowHeight(5),
            }}
          >
            Phone Number:
          </Text>
          <Text
            style={{
              color: color.buttonBg,
              paddingLeft: 5,
              fontSize: fontSizes.FONT20,
              fontWeight: "500",
              paddingVertical: windowHeight(5),
            }}
            onPress={() =>
              Linking.openURL(`tel:${orderData?.driver?.phone_number}`)
            }
          >
            {orderData?.driver?.phone_number}
          </Text>
        </View>
        <Text style={{ fontSize: fontSizes.FONT20, fontWeight: "500" }}>
          {orderData?.driver?.vehicle_type} Color:{" "}
          {orderData?.driver?.vehicle_color}
        </Text>
        <Text
          style={{
            fontSize: fontSizes.FONT20,
            fontWeight: "500",
            paddingVertical: windowHeight(5),
          }}
        >
          Payable amount:{" "}
          {(
            orderData.driver?.distance * parseInt(orderData?.driver?.rate)
          ).toFixed(2)}{" "}
          BDT
        </Text>
        <Text
          style={{
            fontSize: fontSizes.FONT14,
            fontWeight: "400",
            paddingVertical: windowHeight(5),
          }}
        >
          **Pay to your driver after reaching to your destination!
        </Text>
      </View>
    </View>
  );
}
