import Images from "../utils/images";
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

// Helper function to ensure URL has proper scheme
const ensureUrlScheme = (url: string | undefined, defaultScheme: string = "http"): string => {
  if (!url) {
    return "";
  }
  // If URL already has a scheme, return as is
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("ws://") || url.startsWith("wss://")) {
    return url;
  }
  // Add default scheme if missing
  return `${defaultScheme}://${url}`;
};

// Server URI configuration
// Ensures the server URI has the proper http/https scheme
export const getServerUri = (): string => {
  const envUri = process.env.EXPO_PUBLIC_SERVER_URI;
  if (!envUri) {
    // Default fallback based on platform
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3000"; // Android emulator
    } else {
      return "http://localhost:3000"; // iOS simulator
    }
  }
  return ensureUrlScheme(envUri, "http");
};

// WebSocket configuration
// For Android emulator: use 10.0.2.2 (maps to host machine's localhost)
// For iOS simulator: use localhost or 127.0.0.1
// For physical devices: use your computer's local IP (e.g., 192.168.1.2)
// You can override this by setting WEBSOCKET_URL in your environment
export const getWebSocketUrl = (): string => {
  // Check if there's an environment variable override
  const envUrl = process.env.EXPO_PUBLIC_WEBSOCKET_URL;
  if (envUrl) {
    return ensureUrlScheme(envUrl, "ws");
  }

  // Default configuration based on platform
  if (Platform.OS === "android") {
    // Android emulator uses 10.0.2.2 to access host machine
    // For physical Android device, change this to your computer's local IP
    return "ws://10.0.2.2:8080";
  } else {
    // iOS simulator can use localhost
    // For physical iOS device, change this to your computer's local IP
    return "ws://localhost:8080";
  }
};