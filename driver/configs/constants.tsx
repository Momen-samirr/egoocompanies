import { Driving, SmallCard, SmartCar, Wallet } from "@/utils/icons";
import Images from "../utils/images";
import color from "@/themes/app.colors";
import React from "react";
import { Platform } from "react-native";

export const slides = [
  {
    id: 0,
    image: Images.destination,
    text: "Choose Your Destination",
    description: "First choose your destination where you want to go!",
  },
  {
    id: 1,
    image: Images.trip,
    text: "Wait for your driver",
    description: "Just wait for a while now until your driver is picking you!",
  },
  {
    id: 2,
    image: Images.bookRide,
    text: "Enjoy Your Trip",
    description:
      "Now enjoy your trip, pay your driver after reaching the destination!",
  },
];

export const rideData = [
  { id: "1", totalEarning: "Bdt 1200", title: "Total Earning" },
  { id: "2", totalEarning: "12", title: "Complete Scheduled Trips" },
  { id: "3", totalEarning: "1", title: "Pending Ride" },
  { id: "4", totalEarning: "04", title: "Cancel Ride" },
];

export const rideIcons = [
  <Wallet colors={color.primary} />,
  <SmartCar />,
  <SmallCard color={color.primary} />,
  <Driving color={color.primary} />,
];

export const recentRidesData: recentRidesTypes[] = [
  {
    id: "1",
    user: "Shahriar Sajeeb",
    rating: "5",
    earning: "142",
    pickup: "Green line bus stand, Rajar Bag, Dhaka",
    dropoff: "Banani Road no 11, Block F, Dhaka",
    time: "14 July 01:34 pm",
    distance: "8km",
  },
];

// Helper function to ensure URL has proper scheme
const ensureUrlScheme = (url: string | undefined, defaultScheme: string = "http"): string => {
  if (!url) {
    return "";
  }
  
  // Trim whitespace
  url = url.trim();
  
  // Detect and fix double schemes (e.g., "http://http://" or "http://http:")
  // Pattern: http://http: or http://https: or https://http: etc.
  // This handles cases where the env var might have been incorrectly set
  if (url.match(/^https?:\/\/(https?:)/)) {
    // Has double scheme like "http://http://" or "http://http:"
    // Remove the first scheme, keep the second one (which might be malformed)
    url = url.replace(/^https?:\/\/(https?:)/, '$1');
  }
  
  // If URL already has a proper scheme with //, return as is
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("ws://") || url.startsWith("wss://")) {
    return url;
  }
  
  // Handle malformed schemes (e.g., "http:" or "https:" without "//")
  // Remove malformed scheme patterns like "http:" or "https:" at the start
  if (url.match(/^https?:\//)) {
    // Has "http:/" or "https:/" but missing second slash - remove it
    url = url.replace(/^https?:\//, '');
  } else if (url.match(/^https?:/)) {
    // Has "http:" or "https:" but no slashes - remove it
    url = url.replace(/^https?:/, '');
  }
  
  // Remove any leading slashes that might cause issues
  url = url.replace(/^\/+/, '');
  
  // Add default scheme if missing
  return `${defaultScheme}://${url}`;
};

// Server URI configuration
// Ensures the server URI has the proper http/https scheme
export const getServerUri = (): string => {
  const envUri = process.env.EXPO_PUBLIC_SERVER_URI;
  
  console.log('Environment check:', {
    hasEnvVar: !!envUri,
    envUriValue: envUri,
    allEnvKeys: Object.keys(process.env).filter(key => key.startsWith('EXPO_PUBLIC')),
  });
  
  if (!envUri) {
    console.warn('EXPO_PUBLIC_SERVER_URI not found, using default');
    // Default fallback based on platform
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3000"; // Android emulator
    } else {
      return "http://localhost:3000"; // iOS simulator
    }
  }
  
  const cleanedUri = ensureUrlScheme(envUri, "http");
  console.log('Server URI - Original:', envUri, 'Cleaned:', cleanedUri);
  return cleanedUri;
};

// WebSocket configuration
// For Android emulator: use 10.0.2.2 (maps to host machine's localhost)
// For iOS simulator: use localhost or 127.0.0.1
// For physical devices: use your computer's local IP (e.g., 192.168.1.2)
// You can override this by setting WEBSOCKET_URL in your environment
export const getWebSocketUrl = (): string => {
  // Check if there's an environment variable override
  const envUrl = process.env.EXPO_PUBLIC_WEBSOCKET_URL;
  
  console.log('🔌 WebSocket URL check:', {
    hasEnvVar: !!envUrl,
    envUrlValue: envUrl,
    platform: Platform.OS,
  });
  
  if (envUrl) {
    const cleanedUrl = ensureUrlScheme(envUrl, "ws");
    console.log('🔌 Using environment WebSocket URL:', cleanedUrl);
    return cleanedUrl;
  }

  // Default configuration based on platform
  let defaultUrl: string;
  if (Platform.OS === "android") {
    // Android emulator uses 10.0.2.2 to access host machine
    // For physical Android device, change this to your computer's local IP
    defaultUrl = "ws://10.0.2.2:8080";
  } else {
    // iOS simulator can use localhost
    // For physical iOS device, change this to your computer's local IP
    defaultUrl = "ws://localhost:8080";
  }
  
  console.log('🔌 Using default WebSocket URL:', defaultUrl);
  return defaultUrl;
};
