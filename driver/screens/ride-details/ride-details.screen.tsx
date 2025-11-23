import { View, Text, Linking, ScrollView, TouchableOpacity, Platform, Modal } from "react-native";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
import * as GeoLocation from "expo-location";
import NavigationArrow from "@/components/navigation/NavigationArrow";
import { calculateBearing, calculateHeadingFromMovement, Coordinate } from "@/utils/navigation.utils";
import { runMapDiagnostics, logMapDiagnostics } from "@/utils/mapDiagnostics";
import NavigationScreen from "@/components/navigation/NavigationScreen";
import { Coordinate as NavCoordinate } from "@/services/navigationService";
import { calculateDistance } from "@/utils/haversine";

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
  
  // Navigation arrow state
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(
    orderData?.currentLocation ? {
      latitude: orderData.currentLocation.latitude,
      longitude: orderData.currentLocation.longitude,
    } : null
  );
  const [driverHeading, setDriverHeading] = useState<number | null>(null);
  const [bearingToDestination, setBearingToDestination] = useState<number | null>(null);
  const locationWatchSubscription = useRef<any>(null);
  const previousLocation = useRef<Coordinate | null>(null);
  const hasShownProximityNotification = useRef<string | null>(null);
  
  // Map error handling state
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  
  // Navigation state
  const [isNavigationActive, setIsNavigationActive] = useState(false);
  const [navigationMode, setNavigationMode] = useState<"pickup" | "destination">("pickup");

  useEffect(() => {
    checkOnlineStatus();
    
    // Run map diagnostics on mount
    runMapDiagnostics().then((diagnostics) => {
      logMapDiagnostics(diagnostics);
      if (diagnostics.errors.length > 0) {
        setMapError(diagnostics.errors.join(", "));
      }
    });
  }, []);

  // Reset proximity notification flag when order status changes
  useEffect(() => {
    hasShownProximityNotification.current = null;
  }, [orderStatus]);

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
      
      // Initialize current location
      setCurrentLocation({
        latitude: orderData.currentLocation.latitude,
        longitude: orderData.currentLocation.longitude,
      });
      
      // Calculate initial bearing to destination
      if (orderData.marker) {
        const bearing = calculateBearing(
          {
            latitude: orderData.currentLocation.latitude,
            longitude: orderData.currentLocation.longitude,
          },
          {
            latitude: orderData.marker.latitude,
            longitude: orderData.marker.longitude,
          }
        );
        setBearingToDestination(bearing);
      }
    }
  }, []);

  // Set up location watching when trip is Processing or Ongoing
  useEffect(() => {
    if ((orderStatus !== "Ongoing" && orderStatus !== "Processing") || (!orderData?.marker && !orderData?.currentLocation)) {
      // Clean up if trip is not in progress
      if (locationWatchSubscription.current) {
        locationWatchSubscription.current.remove();
        locationWatchSubscription.current = null;
      }
      return;
    }

    let isMounted = true;

    const startLocationWatching = async () => {
      try {
        // Request location permissions if needed
        const { status } = await GeoLocation.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Location permission not granted");
          return;
        }

        // Get initial location
        const initialLocation = await GeoLocation.getCurrentPositionAsync({});
        if (isMounted) {
          setCurrentLocation({
            latitude: initialLocation.coords.latitude,
            longitude: initialLocation.coords.longitude,
          });
        }

        // Start watching position with heading
        const subscription = await GeoLocation.watchPositionAsync(
          {
            accuracy: GeoLocation.Accuracy.High,
            timeInterval: 1000, // Update every second
            distanceInterval: 5, // Update every 5 meters
            mayShowUserSettingsDialog: true,
          },
          (position) => {
            if (!isMounted) return;

            const { latitude, longitude, heading } = position.coords;
            const newLocation: Coordinate = { latitude, longitude };

            // Update current location
            setCurrentLocation(newLocation);

            // Update heading if available (from compass)
            if (heading !== null && heading !== undefined && heading >= 0) {
              setDriverHeading(heading);
            } else if (previousLocation.current) {
              // Fallback: calculate heading from movement
              const calculatedHeading = calculateHeadingFromMovement(
                previousLocation.current,
                newLocation
              );
              if (calculatedHeading !== null) {
                setDriverHeading(calculatedHeading);
              }
            }

            // Calculate bearing to destination
            if (orderData?.marker) {
              const bearing = calculateBearing(newLocation, {
                latitude: orderData.marker.latitude,
                longitude: orderData.marker.longitude,
              });
              setBearingToDestination(bearing);
            }

            // Check proximity to target location based on order status
            let targetLocation: Coordinate | null = null;
            let targetName: string = "";
            let notificationKey: string = "";

            if (orderStatus === "Processing" && orderData?.currentLocation) {
              // Check distance to pickup location
              targetLocation = {
                latitude: orderData.currentLocation.latitude,
                longitude: orderData.currentLocation.longitude,
              };
              targetName = orderData.currentLocationName || "pickup location";
              notificationKey = "pickup";
            } else if (orderStatus === "Ongoing" && orderData?.marker) {
              // Check distance to destination
              targetLocation = {
                latitude: orderData.marker.latitude,
                longitude: orderData.marker.longitude,
              };
              targetName = orderData.destinationLocationName || "destination";
              notificationKey = "destination";
            }

            // Show proximity notification if within 500m
            if (targetLocation && notificationKey) {
              const distance = calculateDistance(
                latitude,
                longitude,
                targetLocation.latitude,
                targetLocation.longitude
              );

              if (distance <= 500 && hasShownProximityNotification.current !== notificationKey) {
                hasShownProximityNotification.current = notificationKey;
                const actionText = orderStatus === "Processing" ? "Pick Up Passenger" : "Complete Ride";
                Toast.show(`You've reached ${targetName}! Please press "${actionText}".`, {
                  type: "success",
                  duration: 5000,
                });
              }
            }

            // Update previous location for next calculation
            previousLocation.current = newLocation;
          }
        );

        locationWatchSubscription.current = subscription;
      } catch (error) {
        console.error("Error setting up location watching:", error);
      }
    };

    startLocationWatching();

    return () => {
      isMounted = false;
      if (locationWatchSubscription.current) {
        locationWatchSubscription.current.remove();
        locationWatchSubscription.current = null;
      }
    };
  }, [orderStatus, orderData?.marker, orderData?.currentLocation]);

  // Update bearing to destination whenever current location changes
  useEffect(() => {
    if (currentLocation && orderData?.marker) {
      const bearing = calculateBearing(currentLocation, {
        latitude: orderData.marker.latitude,
        longitude: orderData.marker.longitude,
      });
      setBearingToDestination(bearing);
      console.log("🧭 Navigation Arrow - Bearing calculated:", bearing, "Heading:", driverHeading);
    }
  }, [currentLocation, orderData?.marker, driverHeading]);

  // Debug: Log arrow visibility conditions
  useEffect(() => {
    const shouldShow = (orderStatus === "Ongoing" || orderStatus === "Processing") && 
                      bearingToDestination !== null && 
                      currentLocation && 
                      orderData?.marker;
    console.log("🧭 Navigation Arrow visibility:", {
      shouldShow,
      orderStatus,
      hasBearing: bearingToDestination !== null,
      hasLocation: !!currentLocation,
      hasMarker: !!orderData?.marker,
      bearing: bearingToDestination,
      heading: driverHeading,
    });
  }, [orderStatus, bearingToDestination, currentLocation, orderData?.marker, driverHeading]);

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
          // Reset proximity notification flag when status changes from Processing to Ongoing
          hasShownProximityNotification.current = null;
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

  const startNavigation = () => {
    if (!currentLocation || !orderData?.marker) {
      Toast.show("Location data not available", { type: "warning" });
      return;
    }

    // Determine navigation mode based on order status
    const mode: "pickup" | "destination" = orderStatus === "Processing" ? "pickup" : "destination";
    setNavigationMode(mode);
    setIsNavigationActive(true);
  };

  const stopNavigation = () => {
    setIsNavigationActive(false);
  };

  const handleNavigationArrival = () => {
    Toast.show("You have arrived!", { type: "success" });
    // Optionally auto-advance to next step
    if (orderStatus === "Processing") {
      // Auto-start trip when arriving at pickup
      // handleSubmit();
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

  // Get origin and destination for navigation
  const getNavigationOrigin = (): NavCoordinate | null => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    };
  };

  const getNavigationDestination = (): NavCoordinate | null => {
    if (!orderData?.marker) return null;
    return {
      latitude: orderData.marker.latitude,
      longitude: orderData.marker.longitude,
    };
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Navigation Screen Modal */}
      {isNavigationActive && getNavigationOrigin() && getNavigationDestination() && (
        <Modal
          visible={isNavigationActive}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <NavigationScreen
            origin={getNavigationOrigin()!}
            destination={getNavigationDestination()!}
            mode={navigationMode}
            onClose={stopNavigation}
            onArrival={handleNavigationArrival}
          />
        </Modal>
      )}

      <Header isOn={isOnline} toggleSwitch={() => {}} showBackButton={true} title="Ride Details" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map View */}
        <View style={{ height: windowHeight(350), borderRadius: 0, position: "relative" }}>
          <MapView
            style={{ flex: 1 }}
            region={useMemo(() => region, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta])}
            onRegionChangeComplete={useCallback((newRegion) => {
              setRegion(newRegion);
            }, [])}
            showsUserLocation={true}
            onMapReady={useCallback(() => {
              console.log("✅ Map ready and loaded successfully");
              setMapReady(true);
              setMapLoading(false);
              setMapError(null);
            }, [])}
            onError={useCallback((error) => {
              console.error("❌ Map error:", error);
              setMapError(`Map error: ${error.message || "Unknown error"}`);
              setMapLoading(false);
            }, [])}
            onDidFailLoadingMap={useCallback((error) => {
              console.error("❌ Map failed to load:", error);
              setMapError(`Failed to load map: ${error.message || "Unknown error"}`);
              setMapLoading(false);
            }, [])}
          >
            {useMemo(() => orderData?.marker && (
              <Marker
                coordinate={orderData.marker}
                title="Destination"
                pinColor={color.status.active}
              />
            ), [orderData?.marker?.latitude, orderData?.marker?.longitude])}
            {useMemo(() => orderData?.currentLocation && (
              <Marker
                coordinate={orderData.currentLocation}
                title="Pickup"
                pinColor={color.status.completed}
              />
            ), [orderData?.currentLocation?.latitude, orderData?.currentLocation?.longitude])}
            {useMemo(() => orderData?.currentLocation && orderData?.marker && (
              <MapViewDirections
                origin={orderData.currentLocation}
                destination={orderData.marker}
                apikey={process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY!}
                strokeWidth={4}
                strokeColor={color.primary}
              />
            ), [orderData?.currentLocation?.latitude, orderData?.currentLocation?.longitude, orderData?.marker?.latitude, orderData?.marker?.longitude])}
          </MapView>
          
          {/* Map Error Display */}
          {mapError && (
            <View
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                right: 10,
                backgroundColor: "rgba(239, 68, 68, 0.9)",
                padding: 12,
                borderRadius: 8,
                zIndex: 1000,
              }}
            >
              <Text style={{ color: "white", fontSize: 12, fontWeight: "bold" }}>
                Map Error: {mapError}
              </Text>
            </View>
          )}
          
          {/* Map Loading Indicator */}
          {mapLoading && !mapError && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 999,
              }}
            >
              <Text style={{ color: "white", fontSize: 14 }}>Loading map...</Text>
            </View>
          )}
          
          {/* Navigation Arrow - Show when we have location and destination data */}
          {bearingToDestination !== null && 
           currentLocation && 
           orderData?.marker && 
           mapReady && (
            <NavigationArrow
              bearingToDestination={bearingToDestination}
              driverHeading={driverHeading}
              size={70}
              color={color.status.active}
              visible={true}
            />
          )}
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
            {/* Start Navigation Button */}
            {(orderStatus === "Processing" || orderStatus === "Ongoing") && (
              <Button
                title={
                  orderStatus === "Processing"
                    ? "🧭 Start Navigation to Pickup"
                    : "🧭 Start Navigation to Destination"
                }
                height={windowHeight(50)}
                backgroundColor={color.status.active}
                onPress={startNavigation}
              />
            )}

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
              <Text style={{ fontSize: 20, marginRight: spacing.sm }}>🗺️</Text>
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
