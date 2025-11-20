import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Dimensions,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import styles from "./styles";
import { useCallback, useEffect, useRef, useState } from "react";
import { external } from "@/styles/external.style";
import { windowHeight, windowWidth } from "@/themes/app.constant";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { router } from "expo-router";
import { Clock, LeftArrow, PickLocation, PickUpLocation } from "@/utils/icons";
import color from "@/themes/app.colors";
import DownArrow from "@/assets/icons/downArrow";
import PlaceHolder from "@/assets/icons/placeHolder";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import _ from "lodash";
import axios from "axios";
import * as Location from "expo-location";
import { Toast } from "react-native-toast-notifications";
import moment from "moment";
import { parseDuration } from "@/utils/time/parse.duration";
import Button from "@/components/common/button";
import { useGetUserData } from "@/hooks/useGetUserData";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { getWebSocketUrl, getServerUri } from "@/configs/constants";

export default function RidePlanScreen() {
  const { user } = useGetUserData();
  const ws = useRef<any>(null);
  const notificationListener = useRef<any>();
  const [wsConnected, setWsConnected] = useState(false);
  const [places, setPlaces] = useState<any>([]);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<any>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [marker, setMarker] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [distance, setDistance] = useState<any>(null);
  const [locationSelected, setlocationSelected] = useState(false);
  const [selectedVehcile, setselectedVehcile] = useState("Car");
  const [travelTimes, setTravelTimes] = useState({
    driving: null,
    walking: null,
    bicycling: null,
    transit: null,
  });
  const [keyboardAvoidingHeight, setkeyboardAvoidingHeight] = useState(false);
  const [driverLists, setdriverLists] = useState([]);
  const [selectedDriver, setselectedDriver] = useState<DriverType>();
  const [driverLoader, setdriverLoader] = useState(false); // Start as false - only show loading when actually requesting
  const [isBooking, setIsBooking] = useState(false); // Prevent multiple booking requests
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const driverLoaderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const orderData = {
          currentLocation: notification.request.content.data.currentLocation,
          marker: notification.request.content.data.marker,
          distance: notification.request.content.data.distance,
          driver: notification.request.content.data.orderData,
        };
        router.push({
          pathname: "/(routes)/ride-details",
          params: { orderData: JSON.stringify(orderData) },
        });
      });

    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current
      );
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Request location permissions
        let { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== "granted") {
          Toast.show(
            "Please approve your location tracking otherwise you can't use this app!",
            {
              type: "danger",
              placement: "bottom",
            }
          );
          console.warn("Location permission not granted");
          return;
        }

        // Check if location services are enabled
        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          Toast.show(
            "Location services are disabled. Please enable them in your device settings.",
            {
              type: "danger",
              placement: "bottom",
            }
          );
          console.warn("Location services are disabled");
          return;
        }

        // Get current location with error handling
        try {
          let location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced, // Use Balanced for better compatibility
          });
          
          const { latitude, longitude } = location.coords;
          console.log("Current location obtained:", { latitude, longitude });
          
          const newRegion = {
            latitude,
            longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          
          setCurrentLocation({ latitude, longitude });
          setRegion(newRegion);
          
          // Update region state - the useEffect will handle animating when map is ready
          // This ensures the map shows the correct location even if it's not ready yet
        } catch (locationError: any) {
          console.error("Error getting current location:", locationError);
          
          // For simulators/emulators, try to get last known location
          try {
            const lastKnownLocation = await Location.getLastKnownPositionAsync();
            
            if (lastKnownLocation) {
              const { latitude, longitude } = lastKnownLocation.coords;
              console.log("Using last known location:", { latitude, longitude });
              
              const newRegion = {
                latitude,
                longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              };
              
              setCurrentLocation({ latitude, longitude });
              setRegion(newRegion);
              
              // Update region state - the useEffect will handle animating when map is ready
              // This ensures the map shows the correct location even if it's not ready yet
            } else {
              // Fallback: Use a default location (you can change this to your city)
              console.warn("No location available, using default location");
              const defaultLocation = { latitude: 37.78825, longitude: -122.4324 };
              setCurrentLocation(defaultLocation);
              setRegion({
                ...defaultLocation,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              });
              
              Toast.show(
                "Unable to get your location. Using default location. Please enable location services.",
                {
                  type: "warning",
                  placement: "bottom",
                  duration: 4000,
                }
              );
            }
          } catch (lastKnownError) {
            console.error("Error getting last known location:", lastKnownError);
            // Use default location as fallback
            const defaultLocation = { latitude: 37.78825, longitude: -122.4324 };
            setCurrentLocation(defaultLocation);
            setRegion({
              ...defaultLocation,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            });
            
            Toast.show(
              "Unable to get your location. Please check your location settings.",
              {
                type: "danger",
                placement: "bottom",
                duration: 4000,
              }
            );
          }
        }
      } catch (error: any) {
        console.error("Location setup error:", error);
        Toast.show(
          "Error setting up location services. Please try again.",
          {
            type: "danger",
            placement: "bottom",
          }
        );
      }
    })();
  }, []);

  const initializeWebSocket = () => {
    const wsUrl = getWebSocketUrl();
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    ws.current = new WebSocket(wsUrl);
    
    // Set message handler once when connection is established
    ws.current.onmessage = async (e: any) => {
      try {
        // Check if data exists and is a string
        if (!e.data || typeof e.data !== 'string') {
          console.warn("Invalid websocket message data:", e.data);
          return;
        }
        
        // Check if data looks like JSON (starts with { or [)
        const trimmed = e.data.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          console.warn("Websocket message is not JSON:", trimmed.substring(0, 50));
          return;
        }
        
        const message = JSON.parse(e.data);
        
        if (message.type === "nearbyDrivers") {
          // Clear timeout since we got a response
          if (driverLoaderTimeoutRef.current) {
            clearTimeout(driverLoaderTimeoutRef.current);
            driverLoaderTimeoutRef.current = null;
          }
          
          // Validate drivers array before making request
          if (Array.isArray(message.drivers) && message.drivers.length > 0) {
            await getDriversData(message.drivers);
          } else {
            console.log("No nearby drivers found");
            setdriverLists([]);
            setdriverLoader(false);
          }
        } else if (message.type === "rideAccepted") {
          // Driver accepted the ride - navigate to ride details screen
          console.log("✅ Ride accepted by driver!", message.rideData);
          
          Toast.show("Driver accepted your ride!", {
            type: "success",
            placement: "bottom",
          });

          // Navigate to ride details screen with the ride data
          const orderData = message.rideData;
          router.push({
            pathname: "/(routes)/ride-details",
            params: { orderData: JSON.stringify(orderData) },
          });
        } else if (message.type === "registered") {
          console.log("✅ User registered with WebSocket server:", message.message);
        }
      } catch (error: any) {
        console.log(error, "Error parsing websocket");
        // Don't crash the app, just log the error
      }
    };
    
    ws.current.onopen = () => {
      console.log("Connected to websocket server");
      setWsConnected(true);
      
      // Register user with socket server when connection opens
      if (user?.id && ws.current && ws.current.readyState === WebSocket.OPEN) {
        console.log(`👤 Registering user ${user.id} with WebSocket server`);
        ws.current.send(
          JSON.stringify({
            type: "registerUser",
            role: "user",
            userId: user.id,
          })
        );
      }
    };

    ws.current.onerror = (e: any) => {
      console.log("WebSocket error:", e.message);
    };

    ws.current.onclose = (e: any) => {
      console.log("WebSocket closed:", e.code, e.reason);
      setWsConnected(false);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        initializeWebSocket();
      }, 5000);
    };
  };

  useEffect(() => {
    initializeWebSocket();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      // Clean up timeout on unmount
      if (driverLoaderTimeoutRef.current) {
        clearTimeout(driverLoaderTimeoutRef.current);
      }
    };
  }, [user?.id]); // Re-initialize when user data is loaded

  useEffect(() => {
    registerForPushNotificationsAsync();
    
    // Check if Google API key is configured
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ Google Cloud API Key (EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY) is not configured in .env file.");
      console.warn("⚠️ Note: For Android MapView, the API key in app.json is also required.");
      Toast.show("Google Maps API key not configured. Please set EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY in your .env file.", {
        type: "danger",
        placement: "bottom",
        duration: 5000,
      });
    } else {
      console.log("✅ Google Maps API Key found in environment variables");
      console.log("📱 For Android native MapView, ensure the API key in app.json matches and has 'Maps SDK for Android' enabled in Google Cloud Console");
      console.log("⚠️ CRITICAL: If you changed app.json, you MUST rebuild the app (not just reload). Run: npx expo prebuild --clean or create a new development build");
      console.log("⚠️ Expo Go does NOT support react-native-maps. You need a development build (EAS Build or local build)");
      console.log("");
      console.log("🔍 DIAGNOSTIC: If map is interactive but tiles aren't loading:");
      console.log("   1. Check Android logs: npx react-native log-android | grep -i 'maps\\|api\\|key'");
      console.log("   2. Verify API key restrictions in Google Cloud Console:");
      console.log("      - Application restrictions: Should be 'None' or include package 'com.becodemy.RideWave' + SHA-1");
      console.log("      - API restrictions: Must include 'Maps SDK for Android'");
      console.log("   3. Get SHA-1: cd android && ./gradlew signingReport");
    }
  }, []);

  async function registerForPushNotificationsAsync() {
    // Only register for push notifications on physical devices
    // Silently skip on emulators/simulators - this is expected behavior
    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        // Only show error if it's a real device and permission was denied
        console.warn("Push notification permission not granted");
        return;
      }
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
      if (!projectId) {
        console.warn("Project ID not found for push notifications");
        return;
      }
      try {
        const pushTokenString = (
          await Notifications.getExpoPushTokenAsync({
            projectId,
          })
        ).data;
        console.log("Push token registered:", pushTokenString);
      } catch (e: unknown) {
        console.warn("Failed to get push token:", e);
      }
    } else {
      // Emulator/Simulator - silently skip, this is expected
      console.log("Push notifications not available on emulator/simulator");
    }

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
  }

  const fetchPlaces = async (input: any) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json`,
        {
          params: {
            input,
            key: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY,
            language: "en",
          },
        }
      );
      setPlaces(response.data.predictions);
    } catch (error) {
      console.log(error);
    }
  };

  const debouncedFetchPlaces = useCallback(_.debounce(fetchPlaces, 100), []);

  useEffect(() => {
    if (query.length > 2) {
      debouncedFetchPlaces(query);
    } else {
      setPlaces([]);
    }
  }, [query, debouncedFetchPlaces]);

  const handleInputChange = (text: any) => {
    setQuery(text);
  };

  const fetchTravelTimes = async (origin: any, destination: any) => {
    const modes = ["driving", "walking", "bicycling", "transit"];
    let travelTimes = {
      driving: null,
      walking: null,
      bicycling: null,
      transit: null,
    } as any;

    for (const mode of modes) {
      let params = {
        origins: `${origin.latitude},${origin.longitude}`,
        destinations: `${destination.latitude},${destination.longitude}`,
        key: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY!,
        mode: mode,
      } as any;

      if (mode === "driving") {
        params.departure_time = "now";
      }

      try {
        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/distancematrix/json`,
          { params }
        );

        const elements = response.data.rows[0].elements[0];
        if (elements.status === "OK") {
          travelTimes[mode] = elements.duration.text;
        }
      } catch (error) {
        console.log(error);
      }
    }

    setTravelTimes(travelTimes);
  };

  const handlePlaceSelect = async (placeId: any) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json`,
        {
          params: {
            place_id: placeId,
            key: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY,
          },
        }
      );
      const { lat, lng } = response.data.result.geometry.location;

      const selectedDestination = { latitude: lat, longitude: lng };
      setRegion({
        ...region,
        latitude: lat,
        longitude: lng,
      });
      setMarker({
        latitude: lat,
        longitude: lng,
      });
      setPlaces([]);
      requestNearbyDrivers();
      setlocationSelected(true);
      setkeyboardAvoidingHeight(false);
      if (currentLocation) {
        await fetchTravelTimes(currentLocation, selectedDestination);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const calculateDistance = (lat1: any, lon1: any, lat2: any, lon2: any) => {
    var p = 0.017453292519943295; // Math.PI / 180
    var c = Math.cos;
    var a =
      0.5 -
      c((lat2 - lat1) * p) / 2 +
      (c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))) / 2;

    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
  };

  const getEstimatedArrivalTime = (travelTime: any) => {
    const now = moment();
    const travelMinutes = parseDuration(travelTime);
    const arrivalTime = now.add(travelMinutes, "minutes");
    return arrivalTime.format("hh:mm A");
  };

  useEffect(() => {
    if (marker && currentLocation) {
      const dist = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        marker.latitude,
        marker.longitude
      );
      setDistance(dist);
    }
  }, [marker, currentLocation]);

  // Animate to current location when both map and location are ready
  useEffect(() => {
    if (mapReady && currentLocation && mapRef.current) {
      const newRegion = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      console.log("📍 Animating map to current location:", newRegion);
      
      // Update region state first
      setRegion(newRegion);
      
      // Then animate to ensure smooth transition
      // Use multiple attempts to ensure it works
      const animateTimeout = setTimeout(() => {
        if (mapRef.current) {
          console.log("🎯 Attempting to animate map to location");
          mapRef.current.animateToRegion(newRegion, 1000);
        }
      }, 200);
      
      // Also try after a longer delay as fallback
      const fallbackTimeout = setTimeout(() => {
        if (mapRef.current) {
          console.log("🔄 Fallback: Animating map to location");
          mapRef.current.animateToRegion(newRegion, 1000);
        }
      }, 1000);
      
      return () => {
        clearTimeout(animateTimeout);
        clearTimeout(fallbackTimeout);
      };
    }
  }, [mapReady, currentLocation]);

  // Force map ready after timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!mapReady) {
        console.log("⏱️ Force setting map as ready after timeout - onMapReady may not have fired");
        setMapReady(true);
        setMapError(null);
        // Try to animate to location if we have it
        if (mapRef.current && currentLocation) {
          const newRegion = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          console.log("📍 Force animating to location:", newRegion);
          mapRef.current.animateToRegion(newRegion, 1000);
        }
      }
    }, 1000); // Reduced to 1 second - map should appear immediately

    return () => clearTimeout(timeout);
  }, [mapReady, currentLocation]);
  
  // Set map ready immediately when location is obtained (if map container exists)
  useEffect(() => {
    if (currentLocation && mapRef.current && !mapReady) {
      // Give map a moment to render, then set ready
      const timeout = setTimeout(() => {
        console.log("📍 Location obtained, forcing map ready");
        setMapReady(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [currentLocation, mapReady]);


  const getDriversData = async (drivers: any) => {
    try {
      // Validate drivers array
      if (!Array.isArray(drivers) || drivers.length === 0) {
        console.warn("Invalid drivers array:", drivers);
        setdriverLists([]);
        setdriverLoader(false);
        return;
      }

      // Extract driver IDs from the drivers array
      const driverIds = drivers
        .map((driver: any) => driver?.id)
        .filter((id: any) => id != null)
        .join(",");

      if (!driverIds) {
        console.warn("No valid driver IDs found");
        setdriverLists([]);
        setdriverLoader(false);
        return;
      }

      const response = await axios.get(
        `${getServerUri()}/driver/get-drivers-data`,
        {
          params: { ids: driverIds },
        }
      );

      const driverData = response.data;
      
      // CRITICAL: Log driver data to verify notification tokens
      console.log("📋 ===== DRIVER DATA RECEIVED =====");
      console.log("📋 Number of drivers:", driverData?.length || 0);
      if (driverData && Array.isArray(driverData)) {
        driverData.forEach((driver: any, index: number) => {
          console.log(`📋 Driver ${index + 1}:`);
          console.log(`  - ID: ${driver.id}`);
          console.log(`  - Name: ${driver.name}`);
          console.log(`  - Notification Token: ${driver.notificationToken || "❌ NOT SET"}`);
          console.log(`  - Token format: ${driver.notificationToken?.startsWith("ExponentPushToken[") ? "✅ Valid" : "❌ Invalid/Missing"}`);
        });
      }
      
      setdriverLists(driverData || []);
      setdriverLoader(false);
    } catch (error: any) {
      console.error("Error fetching driver data:", error);
      setdriverLists([]);
      setdriverLoader(false);
      
      // Show user-friendly error message
      if (error.response) {
        Toast.show("Failed to load driver information", {
          type: "danger",
          placement: "bottom",
        });
      } else if (error.request) {
        Toast.show("Network error. Please check your connection", {
          type: "danger",
          placement: "bottom",
        });
      }
    }
  };

  const requestNearbyDrivers = () => {
    console.log("WebSocket connected:", wsConnected);
    if (!currentLocation) {
      console.warn("Cannot request drivers: no current location");
      return;
    }
    
    if (!wsConnected) {
      console.warn("Cannot request drivers: WebSocket not connected");
      Toast.show("Connecting to server...", {
        type: "warning",
        placement: "bottom",
      });
      return;
    }
    
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn("Cannot request drivers: WebSocket not open");
      Toast.show("Connection not ready. Please try again.", {
        type: "warning",
        placement: "bottom",
      });
      return;
    }
    
    try {
      // Clear any existing timeout
      if (driverLoaderTimeoutRef.current) {
        clearTimeout(driverLoaderTimeoutRef.current);
      }
      
      // Reset driver loader when requesting
      setdriverLoader(true);
      setdriverLists([]);
      
      // Set a timeout to stop loading after 10 seconds if no response
      driverLoaderTimeoutRef.current = setTimeout(() => {
        console.warn("Driver request timeout - no response received");
        setdriverLoader(false);
        setdriverLists([]);
        Toast.show("No drivers found nearby. Please try again later.", {
          type: "warning",
          placement: "bottom",
        });
      }, 10000); // 10 second timeout
      
      ws.current.send(
        JSON.stringify({
          type: "requestRide",
          role: "user",
          userId: user?.id, // Include userId to register for ride updates
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        })
      );
      // Message handler is already set in initializeWebSocket
    } catch (error: any) {
      console.error("Error sending WebSocket message:", error);
      setdriverLoader(false);
      if (driverLoaderTimeoutRef.current) {
        clearTimeout(driverLoaderTimeoutRef.current);
      }
      Toast.show("Failed to request nearby drivers", {
        type: "danger",
        placement: "bottom",
      });
    }
  };

  const sendPushNotification = async (expoPushToken: string, data: any) => {
    // CRITICAL: Verify token format before sending
    if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken[")) {
      console.error("❌ Invalid push token format:", expoPushToken);
      throw new Error("Invalid push token format");
    }
    
    // Ensure data is a string if it's an object
    const orderDataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // CRITICAL: Use the correct Expo push notification endpoint
    // This is the official Expo push notification API endpoint
    const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
    
    const message = {
      to: expoPushToken,
      sound: "default",
      title: "New Ride Request",
      body: "You have a new ride request. Tap to view details.",
      data: { 
        orderData: orderDataString 
      },
      priority: "high",
      channelId: "default",
    };

    console.log("📤 ===== SENDING PUSH NOTIFICATION =====");
    console.log("📤 Endpoint:", EXPO_PUSH_ENDPOINT);
    console.log("📤 Token:", expoPushToken);
    console.log("📤 Token format:", expoPushToken.startsWith("ExponentPushToken[") ? "✅ Valid" : "❌ Invalid");
    console.log("📤 Notification payload:", JSON.stringify(message, null, 2));
    console.log("📤 Timestamp:", new Date().toISOString());
    
    try {
      const response = await axios.post(EXPO_PUSH_ENDPOINT, message, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        timeout: 30000, // 30 second timeout
      });
      
      console.log("✅ ===== PUSH NOTIFICATION SENT SUCCESSFULLY =====");
      console.log("✅ Expo response:", JSON.stringify(response.data, null, 2));
      console.log("✅ Response status:", response.status);
      console.log("✅ Notification ID:", response.data?.data?.id);
      console.log("✅ Delivery status:", response.data?.data?.status);
      
      // Verify response indicates success
      if (response.data?.data?.status === "ok") {
        console.log("✅ Expo confirmed notification will be delivered");
        console.log("✅ Notification ID:", response.data?.data?.id);
      } else {
        console.warn("⚠️ Expo response status:", response.data?.data?.status);
        console.warn("⚠️ Notification may not be delivered");
      }
      
      return response.data;
    } catch (error: any) {
      console.error("❌ ===== ERROR SENDING PUSH NOTIFICATION =====");
      console.error("❌ Error message:", error.message);
      console.error("❌ Error code:", error.code);
      console.error("❌ Error response:", error.response?.data);
      console.error("❌ Error status:", error.response?.status);
      console.error("❌ Full error:", JSON.stringify(error, null, 2));
      
      // Provide specific error messages
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.error("❌ Request timeout - Expo push service may be slow");
      } else if (error.response?.status === 400) {
        console.error("❌ Bad request - check token format and payload");
      } else if (error.response?.status === 429) {
        console.error("❌ Rate limited - too many requests");
      } else if (error.response?.status >= 500) {
        console.error("❌ Server error - Expo push service may be down");
      }
      
      throw error;
    }
  };

  const handleOrder = async () => {
    // Prevent multiple simultaneous booking requests
    if (isBooking) {
      console.log("⚠️ Booking already in progress, ignoring duplicate request");
      return;
    }

    // Validate that a driver is selected
    if (!selectedDriver) {
      Toast.show("Please select a driver first", {
        type: "danger",
        placement: "bottom",
      });
      return;
    }

    // Note: We allow booking even if driver doesn't have notificationToken
    // The driver will receive the notification when they log in next time
    // No need to show a warning - booking will still work

    // Validate required data
    if (!currentLocation || !marker || !distance || !user) {
      Toast.show("Missing required information. Please try again.", {
        type: "danger",
        placement: "bottom",
      });
      return;
    }

    // Set booking state to prevent multiple clicks
    setIsBooking(true);

    try {
      // Get location names
      const currentLocationNameResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${currentLocation.latitude},${currentLocation.longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY}`
      );
      const destinationLocationNameResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${marker.latitude},${marker.longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY}`
      );

      const currentLocationName =
        currentLocationNameResponse.data.results[0]?.formatted_address || "Current Location";
      const destinationLocationName =
        destinationLocationNameResponse.data.results[0]?.formatted_address || "Destination";

      // Prepare data with all driver information
      const data = {
        user,
        driver: selectedDriver,
        currentLocation,
        marker,
        distance: distance.toFixed(2),
        currentLocationName,
        destinationLocation: destinationLocationName,
        vehicle_type: selectedDriver.vehicle_type,
        rate: selectedDriver.rate,
        price: (distance * parseFloat(selectedDriver.rate)).toFixed(2),
      };

      // Send push notification to the selected driver if token is available
      if (selectedDriver.notificationToken) {
        try {
          console.log("📤 ===== SENDING PUSH NOTIFICATION =====");
          console.log("📤 Driver ID:", selectedDriver.id);
          console.log("📤 Driver name:", selectedDriver.name);
          console.log("📤 Driver notification token:", selectedDriver.notificationToken);
          console.log("📤 Token format:", selectedDriver.notificationToken.startsWith("ExponentPushToken[") ? "✅ Valid format" : "❌ Invalid format");
          console.log("📤 Full data being sent:", JSON.stringify(data, null, 2));
          
          // Verify token format
          if (!selectedDriver.notificationToken.startsWith("ExponentPushToken[")) {
            console.error("❌ Invalid notification token format!");
            Toast.show("Invalid driver notification token", {
              type: "danger",
              placement: "bottom",
            });
            return;
          }
          
          // Send data as object - sendPushNotification will handle stringification
          const response = await sendPushNotification(selectedDriver.notificationToken, data);
          
          console.log("✅ ===== PUSH NOTIFICATION SENT SUCCESSFULLY =====");
          console.log("✅ Driver ID:", selectedDriver.id);
          console.log("✅ Expo response:", JSON.stringify(response, null, 2));
          
          // Check Expo response for delivery status
          if (response?.data?.status === "ok") {
            console.log("✅ Expo accepted notification - should be delivered to device");
            console.log("✅ Notification ID:", response.data?.id);
            console.log("ℹ️ Note: If notification doesn't appear, check:");
            console.log("   1. Driver app is running and connected to internet");
            console.log("   2. Driver app token matches database token");
            console.log("   3. Driver app has notification permissions");
            console.log("   4. Driver app project ID matches user app project ID");
          } else {
            console.warn("⚠️ Expo response status:", response?.data?.status);
            console.warn("⚠️ Notification might not be delivered");
          }
        } catch (error: any) {
          console.error("❌ ===== ERROR SENDING PUSH NOTIFICATION =====");
          console.error("❌ Error message:", error.message);
          console.error("❌ Error response:", error.response?.data);
          console.error("❌ Error status:", error.response?.status);
          console.error("❌ Full error:", JSON.stringify(error, null, 2));
          
          // Show error to user
          Toast.show("Failed to send notification. Driver will be notified when they come online.", {
            type: "warning",
            placement: "bottom",
            duration: 4000,
          });
        }
      } else {
        // Driver doesn't have notification token yet
        console.log("⚠️ Driver notification token not available");
        console.log("⚠️ Driver ID:", selectedDriver.id);
        console.log("⚠️ Driver name:", selectedDriver.name);
        console.log("ℹ️ Driver will be notified when they log in next time");
        
        Toast.show("Driver will be notified when they come online", {
          type: "info",
          placement: "bottom",
          duration: 3000,
        });
      }
      
      // Always show success message - booking is complete
      Toast.show("Ride request sent successfully!", {
        type: "success",
        placement: "bottom",
      });
    } catch (error: any) {
      console.error("Error sending ride request:", error);
      Toast.show("Failed to send ride request. Please try again.", {
        type: "danger",
        placement: "bottom",
      });
    } finally {
      // Reset booking state in finally block to ensure it's always reset
      setIsBooking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[external.fx_1]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View>
        <View
          style={{ 
            height: windowHeight(!keyboardAvoidingHeight ? 500 : 300), 
            position: "relative", 
            overflow: "visible", // Changed from "hidden" to "visible" to ensure map renders
            backgroundColor: "#e0e0e0",
            minHeight: 300, // Ensure minimum height
            elevation: 0, // Android shadow
          }}
        >
          {/* Always show map - don't block it with overlay */}
          <MapView
            ref={mapRef}
            style={{ 
              flex: 1, 
              backgroundColor: "#e0e0e0", 
              width: "100%", 
              height: "100%", 
              zIndex: 1,
              opacity: 1,
              elevation: 0 // Android shadow
            }}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            initialRegion={region}
            region={region}
            mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
            onRegionChangeComplete={(newRegion) => {
              // Only update if map is ready and region actually changed to prevent infinite loops
              if (mapReady && (
                Math.abs(newRegion.latitude - region.latitude) > 0.0001 ||
                Math.abs(newRegion.longitude - region.longitude) > 0.0001
              )) {
                setRegion(newRegion);
              }
            }}
            onMapReady={() => {
              console.log("✅ Map is ready - onMapReady callback fired");
              setMapReady(true);
              setMapError(null);
              // Force map to be visible immediately
              if (mapRef.current) {
                // If we already have location, animate to it
                if (currentLocation) {
                  const newRegion = {
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  };
                  console.log("📍 Map ready with location, updating region and animating to:", newRegion);
                  // Update region state first
                  setRegion(newRegion);
                  // Use animateToRegion to ensure map updates
                  setTimeout(() => {
                    if (mapRef.current) {
                      mapRef.current.animateToRegion(newRegion, 1000);
                    }
                  }, 100);
                } else {
                  // Even without location, ensure map is visible with default region
                  console.log("🗺️ Map ready but no location yet - showing default region");
                  // The map will show the initialRegion which is already set
                }
              }
            }}
            onLayout={() => {
              console.log("📐 MapView onLayout fired - map container rendered");
              // Fallback: if onMapReady doesn't fire, set ready after layout
              setTimeout(() => {
                if (!mapReady) {
                  console.log("⚠️ Map layout complete but onMapReady didn't fire - setting ready as fallback");
                  setMapReady(true);
                }
              }, 1000); // Reduced to 1 second
            }}
            showsUserLocation={currentLocation !== null}
            showsMyLocationButton={Platform.OS === "android" ? true : false}
            followsUserLocation={false}
            mapType="standard"
            toolbarEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            cacheEnabled={true}
            moveOnMarkerPress={false}
            liteMode={false}
            loadingEnabled={false}
            onPress={(e) => {
              console.log("🗺️ Map pressed at:", e.nativeEvent.coordinate);
            }}
            onPoiClick={(e) => {
              console.log("📍 POI clicked:", e.nativeEvent);
            }}
            onMapLoaded={() => {
              console.log("🗺️✅ Map tiles loaded successfully!");
              setMapReady(true);
            }}
            onKmlReady={(e) => {
              console.log("🗺️ KML ready:", e);
            }}
            onPanDrag={(e) => {
              console.log("🗺️ Map being dragged - map is interactive!");
            }}
            onRegionChange={(newRegion) => {
              console.log("🗺️ Region changed to:", newRegion.latitude.toFixed(4), newRegion.longitude.toFixed(4));
            }}
          >
            {marker && (
              <Marker
                coordinate={marker}
                title="Destination"
                description="Your destination"
                pinColor="red"
              />
            )}
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Your Location"
                description="Current location"
                pinColor="blue"
              />
            )}
            {currentLocation && marker && (
              <MapViewDirections
                origin={currentLocation}
                destination={marker}
                apikey={process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY!}
                strokeWidth={4}
                strokeColor="blue"
                optimizeWaypoints={true}
                onReady={(result) => {
                  console.log("Directions ready:", result);
                }}
                onError={(errorMessage) => {
                  // ZERO_RESULTS is expected in some cases (e.g., invalid coordinates, impossible routes)
                  if (errorMessage.includes("ZERO_RESULTS")) {
                    console.log("No route found between points - this may be normal");
                  } else {
                    console.error("Directions error:", errorMessage);
                  }
                }}
              />
            )}
          </MapView>
          {/* Show loading indicator only briefly, then hide it so map can render */}
          {!mapReady && !mapError && (
            <View style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(255, 255, 255, 0.9)", padding: 10, borderRadius: 5, zIndex: 1000, flexDirection: "row", alignItems: "center" }}>
              <ActivityIndicator size="small" color="#0000ff" style={{ marginRight: 8 }} />
              <Text style={{ color: "#666", fontSize: 12 }}>Loading map...</Text>
            </View>
          )}
          {mapError && (
            <View style={{ position: "absolute", top: 10, left: 10, right: 10, backgroundColor: "#ff4444", padding: 10, borderRadius: 5, zIndex: 1000 }}>
              <Text style={{ color: "#fff", fontSize: 12 }}>Map Error: {mapError}</Text>
            </View>
          )}
          {/* Debug info - remove in production */}
          {__DEV__ && mapReady && (
            <View style={{ position: "absolute", bottom: 10, left: 10, backgroundColor: "rgba(0, 0, 0, 0.7)", padding: 8, borderRadius: 5, zIndex: 1000 }}>
              <Text style={{ color: "#fff", fontSize: 10 }}>
                Map Ready: {mapReady ? "✅" : "❌"}
              </Text>
              <Text style={{ color: "#fff", fontSize: 10 }}>
                Location: {currentLocation ? "✅" : "❌"}
              </Text>
              <Text style={{ color: "#fff", fontSize: 10 }}>
                Region: {region.latitude.toFixed(4)}, {region.longitude.toFixed(4)}
              </Text>
              <Text style={{ color: "#fff", fontSize: 10 }}>
                Provider: {Platform.OS === "android" ? "Google" : "Default"}
              </Text>
              <Text style={{ color: "#fff", fontSize: 10 }}>
                API Key: {process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY ? "✅ Set" : "❌ Missing"}
              </Text>
            </View>
          )}
          {/* Test if map is actually visible - add a colored overlay to verify container */}
          {__DEV__ && (
            <>
              <View 
                style={{ 
                  position: "absolute", 
                  top: 50, 
                  right: 10, 
                  backgroundColor: "rgba(255, 0, 0, 0.5)", 
                  padding: 5, 
                  borderRadius: 3, 
                  zIndex: 999,
                  pointerEvents: "none"
                }}
              >
                <Text style={{ color: "#fff", fontSize: 8, fontWeight: "bold" }}>MAP CONTAINER</Text>
              </View>
              {/* Add a semi-transparent overlay to test if map is behind it */}
              <View 
                style={{ 
                  position: "absolute", 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0, 
                  backgroundColor: "rgba(0, 255, 0, 0.1)", 
                  zIndex: 998,
                  pointerEvents: "none",
                  borderWidth: 2,
                  borderColor: "red"
                }}
              />
            </>
          )}
        </View>
      </View>
      <View style={styles.contentContainer}>
        <View style={[styles.container]}>
          {locationSelected ? (
            <>
              {driverLoader ? (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    height: 400,
                  }}
                >
                  <ActivityIndicator size={"large"} />
                </View>
              ) : (
                <ScrollView
                  style={{
                    paddingBottom: windowHeight(20),
                    height: windowHeight(280),
                  }}
                >
                  <View
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#b5b5b5",
                      paddingBottom: windowHeight(10),
                      flexDirection: "row",
                    }}
                  >
                    <Pressable onPress={() => setlocationSelected(false)}>
                      <LeftArrow />
                    </Pressable>
                    <Text
                      style={{
                        margin: "auto",
                        fontSize: 20,
                        fontWeight: "600",
                      }}
                    >
                      Gathering options
                    </Text>
                  </View>
                  <View style={{ padding: windowWidth(10) }}>
                    {driverLists?.map((driver: DriverType) => (
                      <Pressable
                        key={driver.id}
                        style={{
                          width: windowWidth(420),
                          borderWidth:
                            selectedDriver?.id === driver.id ? 2 : 0,
                          borderColor: selectedDriver?.id === driver.id ? "#000" : "transparent",
                          borderRadius: 10,
                          padding: 10,
                          marginVertical: 5,
                        }}
                        onPress={() => {
                          setselectedDriver(driver);
                          setselectedVehcile(driver.vehicle_type);
                        }}
                      >
                        <View style={{ margin: "auto" }}>
                          <Image
                            source={
                              driver?.vehicle_type === "Car"
                                ? require("@/assets/images/vehicles/car.png")
                                : driver?.vehicle_type === "Motorcycle"
                                ? require("@/assets/images/vehicles/bike.png")
                                : require("@/assets/images/vehicles/bike.png")
                            }
                            style={{ width: 90, height: 80 }}
                          />
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <View>
                            <Text style={{ fontSize: 20, fontWeight: "600" }}>
                              Egoo {driver?.vehicle_type}
                            </Text>
                            <Text style={{ fontSize: 16 }}>
                              {getEstimatedArrivalTime(travelTimes.driving)}{" "}
                              dropoff
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontSize: windowWidth(20),
                              fontWeight: "600",
                            }}
                          >
                            BDT{" "}
                            {(
                              distance.toFixed(2) * parseInt(driver.rate)
                            ).toFixed(2)}
                          </Text>
                        </View>
                      </Pressable>
                    ))}

                    <View
                      style={{
                        paddingHorizontal: windowWidth(10),
                        marginTop: windowHeight(15),
                      }}
                    >
                      <Button
                        backgroundColor={selectedDriver && !isBooking ? "#000" : "#ccc"}
                        textColor="#fff"
                        title={isBooking ? "Booking..." : selectedDriver ? "Confirm Booking" : "Select a driver to continue"}
                        onPress={() => handleOrder()}
                        disabled={!selectedDriver || isBooking}
                      />
                    </View>
                  </View>
                </ScrollView>
              )}
            </>
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity onPress={() => router.back()}>
                  <LeftArrow />
                </TouchableOpacity>
                <Text
                  style={{
                    margin: "auto",
                    fontSize: windowWidth(25),
                    fontWeight: "600",
                  }}
                >
                  Plan your ride
                </Text>
              </View>
              {/* picking up time */}
              <View
                style={{
                  width: windowWidth(200),
                  height: windowHeight(28),
                  borderRadius: 20,
                  backgroundColor: color.lightGray,
                  alignItems: "center",
                  justifyContent: "center",
                  marginVertical: windowHeight(10),
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Clock />
                  <Text
                    style={{
                      fontSize: windowHeight(12),
                      fontWeight: "600",
                      paddingHorizontal: 8,
                    }}
                  >
                    Pick-up now
                  </Text>
                  <DownArrow />
                </View>
              </View>
              {/* picking up location */}
              <View
                style={{
                  borderWidth: 2,
                  borderColor: "#000",
                  borderRadius: 15,
                  marginBottom: windowHeight(15),
                  paddingHorizontal: windowWidth(15),
                  paddingVertical: windowHeight(5),
                }}
              >
                <View style={{ flexDirection: "row" }}>
                  <PickLocation />
                  <View
                    style={{
                      width: Dimensions.get("window").width * 1 - 110,
                      borderBottomWidth: 1,
                      borderBottomColor: "#999",
                      marginLeft: 5,
                      height: windowHeight(20),
                    }}
                  >
                    <Text
                      style={{
                        color: "#2371F0",
                        fontSize: 18,
                        paddingLeft: 5,
                      }}
                    >
                      Current Location
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    paddingVertical: 12,
                  }}
                >
                  <PlaceHolder />
                  <View
                    style={{
                      marginLeft: 5,
                      width: Dimensions.get("window").width * 1 - 110,
                    }}
                  >
                    <GooglePlacesAutocomplete
                      placeholder="Where to?"
                      onPress={(data, details = null) => {
                        setkeyboardAvoidingHeight(true);
                        if (details) {
                          // Use the details to get full place information
                          const { lat, lng } = details.geometry.location;
                          const selectedDestination = { latitude: lat, longitude: lng };
                          setMarker(selectedDestination);
                          setRegion({
                            ...region,
                            latitude: lat,
                            longitude: lng,
                          });
                          setPlaces([]);
                          setlocationSelected(true);
                          setkeyboardAvoidingHeight(false);
                          if (currentLocation) {
                            fetchTravelTimes(currentLocation, selectedDestination);
                          }
                          requestNearbyDrivers();
                        } else {
                          // Fallback to using place_id
                          setPlaces([
                            {
                              description: data.description,
                              place_id: data.place_id,
                            },
                          ]);
                        }
                      }}
                      query={{
                        key: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY || "",
                        language: "en",
                      }}
                      styles={{
                        container: {
                          flex: 0,
                          width: "100%",
                        },
                        textInputContainer: {
                          width: "100%",
                          backgroundColor: "transparent",
                          borderTopWidth: 0,
                          borderBottomWidth: 0,
                          paddingHorizontal: 0,
                        },
                        textInput: {
                          height: 38,
                          color: "#000",
                          fontSize: 16,
                          backgroundColor: "transparent",
                          marginLeft: 0,
                          marginRight: 0,
                        },
                        listView: {
                          backgroundColor: "#fff",
                          borderRadius: 5,
                          marginTop: 5,
                          elevation: 3,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 3.84,
                        },
                        row: {
                          backgroundColor: "#fff",
                          padding: 13,
                          height: 44,
                          flexDirection: "row",
                        },
                        separator: {
                          height: 1,
                          backgroundColor: "#c8c7cc",
                        },
                        description: {
                          color: "#000",
                        },
                        predefinedPlacesDescription: {
                          color: "#000",
                        },
                      }}
                      textInputProps={{
                        onChangeText: (text) => handleInputChange(text),
                        value: query,
                        onFocus: () => setkeyboardAvoidingHeight(true),
                        autoFocus: false,
                        returnKeyType: "search",
                      }}
                      onFail={(error) => {
                        console.error("Google Places Autocomplete Error:", error);
                        Toast.show("Failed to load places. Please check your internet connection.", {
                          type: "danger",
                          placement: "bottom",
                        });
                      }}
                      fetchDetails={true}
                      debounce={200}
                      enablePoweredByContainer={false}
                      minLength={2}
                      suppressDefaultStyles={false}
                      isRowScrollable={true}
                      keepResultsAfterBlur={false}
                    />
                  </View>
                </View>
              </View>
              {/* Last sessions */}
              {places.map((place: any, index: number) => (
                <Pressable
                  key={index}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: windowHeight(20),
                  }}
                  onPress={() => handlePlaceSelect(place.place_id)}
                >
                  <PickUpLocation />
                  <Text style={{ paddingLeft: 15, fontSize: 18 }}>
                    {place.description}
                  </Text>
                </Pressable>
              ))}
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
