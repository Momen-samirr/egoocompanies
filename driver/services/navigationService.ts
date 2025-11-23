import axios from "axios";
import Constants from "expo-constants";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  html_instructions: string;
  maneuver?: string; // e.g., "turn-left", "straight", "turn-right"
  start_location: Coordinate;
  end_location: Coordinate;
  polyline: {
    points: string; // encoded polyline
  };
}

export interface Route {
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  start_address: string;
  end_address: string;
  steps: RouteStep[];
  overview_polyline: {
    points: string; // encoded polyline for the full route
  };
  bounds: {
    northeast: Coordinate;
    southwest: Coordinate;
  };
}

export interface DirectionsResponse {
  routes: Route[];
  status: string;
  error_message?: string;
}

// Cache for routes to reduce API calls
const routeCache = new Map<string, { route: Route; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get Google Maps API key from environment or config
 */
function getGoogleMapsApiKey(): string {
  const envKey = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
  const configKey = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
  
  if (envKey) {
    return envKey;
  }
  
  if (configKey) {
    return configKey;
  }
  
  throw new Error("Google Maps API key not found. Please set EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY");
}

/**
 * Generate cache key for route
 */
function generateCacheKey(origin: Coordinate, destination: Coordinate, waypoints?: Coordinate[]): string {
  const originStr = `${origin.latitude},${origin.longitude}`;
  const destStr = `${destination.latitude},${destination.longitude}`;
  const waypointsStr = waypoints?.map(w => `${w.latitude},${w.longitude}`).join("|") || "";
  return `${originStr}|${destStr}|${waypointsStr}`;
}

/**
 * Calculate route from origin to destination using Google Maps Directions API
 */
export async function calculateRoute(
  origin: Coordinate,
  destination: Coordinate,
  waypoints?: Coordinate[],
  alternatives: boolean = false
): Promise<Route | null> {
  try {
    // Validate input coordinates
    if (!origin || typeof origin.latitude !== 'number' || typeof origin.longitude !== 'number') {
      console.error("❌ Invalid origin coordinates:", origin);
      throw new Error("Invalid origin coordinates");
    }
    
    if (!destination || typeof destination.latitude !== 'number' || typeof destination.longitude !== 'number') {
      console.error("❌ Invalid destination coordinates:", destination);
      throw new Error("Invalid destination coordinates");
    }
    
    // Validate coordinate ranges
    if (origin.latitude < -90 || origin.latitude > 90 || origin.longitude < -180 || origin.longitude > 180) {
      console.error("❌ Origin coordinates out of valid range:", origin);
      throw new Error("Origin coordinates out of valid range");
    }
    
    if (destination.latitude < -90 || destination.latitude > 90 || destination.longitude < -180 || destination.longitude > 180) {
      console.error("❌ Destination coordinates out of valid range:", destination);
      throw new Error("Destination coordinates out of valid range");
    }
    
    const apiKey = getGoogleMapsApiKey();
    
    if (!apiKey) {
      console.error("❌ Google Maps API key not found");
      throw new Error("Google Maps API key not configured");
    }
    
    // Check cache first
    const cacheKey = generateCacheKey(origin, destination, waypoints);
    const cached = routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log("📍 Using cached route");
      return cached.route;
    }
    
    // Build waypoints parameter
    let waypointsParam = "";
    if (waypoints && waypoints.length > 0) {
      const waypointsStr = waypoints.map(w => `${w.latitude},${w.longitude}`).join("|");
      waypointsParam = `&waypoints=${encodeURIComponent(waypointsStr)}`;
    }
    
    // Build URL
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}${waypointsParam}&alternatives=${alternatives}&key=${apiKey}`;
    
    console.log("📍 Calculating route from", originStr, "to", destStr);
    console.log("📍 API Key present:", !!apiKey, "Key length:", apiKey?.length || 0);
    
    const response = await axios.get<DirectionsResponse>(url, {
      timeout: 10000, // 10 second timeout
    });
    
    console.log("📍 Directions API response status:", response.data.status);
    
    if (response.data.status !== "OK") {
      console.error("❌ Directions API error:", response.data.status, response.data.error_message);
      const errorMsg = response.data.error_message || `Directions API returned status: ${response.data.status}`;
      console.error("❌ Full error details:", JSON.stringify(response.data, null, 2));
      throw new Error(errorMsg);
    }
    
    if (!response.data.routes || response.data.routes.length === 0) {
      console.error("❌ No routes found in response");
      console.error("❌ Response data:", JSON.stringify(response.data, null, 2));
      return null;
    }
    
    // Use first route (shortest/fastest)
    const route = response.data.routes[0];
    
    // Validate route structure
    if (!route || !route.distance || !route.distance.value || !route.duration || !route.duration.value) {
      console.error("❌ Invalid route structure received");
      console.error("❌ Route data:", JSON.stringify(route, null, 2));
      return null;
    }
    
    // Cache the route
    routeCache.set(cacheKey, { route, timestamp: Date.now() });
    
    console.log("✅ Route calculated:", {
      distance: route.distance?.text || "N/A",
      duration: route.duration?.text || "N/A",
      steps: route.steps?.length || 0,
    });
    
    return route;
  } catch (error: any) {
    console.error("❌ Error calculating route:", error);
    if (error.response) {
      console.error("❌ Response status:", error.response.status);
      console.error("❌ Response data:", JSON.stringify(error.response.data, null, 2));
    }
    if (error.request) {
      console.error("❌ Request error - no response received");
      console.error("❌ Request URL:", error.config?.url);
    }
    throw error;
  }
}

/**
 * Recalculate route from current position to destination
 * This is called when driver deviates from the route
 */
export async function recalculateRoute(
  currentLocation: Coordinate,
  destination: Coordinate,
  waypoints?: Coordinate[]
): Promise<Route | null> {
  console.log("🔄 Recalculating route from current position");
  
  // Clear cache for this destination to force fresh calculation
  const cacheKey = generateCacheKey(currentLocation, destination, waypoints);
  routeCache.delete(cacheKey);
  
  return calculateRoute(currentLocation, destination, waypoints);
}

/**
 * Get current step based on driver's position
 * Returns the step the driver should currently follow
 */
export function getCurrentStep(
  route: Route,
  driverLocation: Coordinate,
  completedSteps: number[] = []
): RouteStep | null {
  if (!route.steps || route.steps.length === 0) {
    return null;
  }
  
  // Find the step closest to driver's current position
  let closestStep: RouteStep | null = null;
  let minDistance = Infinity;
  
  for (let i = 0; i < route.steps.length; i++) {
    // Skip completed steps
    if (completedSteps.includes(i)) {
      continue;
    }
    
    const step = route.steps[i];
    const stepDistance = calculateDistance(
      driverLocation,
      step.end_location
    );
    
    // If driver is close to step end location, consider next step
    if (stepDistance < minDistance) {
      minDistance = stepDistance;
      closestStep = step;
    }
  }
  
  return closestStep || route.steps[0];
}

/**
 * Get next turn instruction
 * Returns the next maneuver the driver needs to make
 */
export function getNextTurnInstruction(
  route: Route,
  driverLocation: Coordinate,
  completedSteps: number[] = []
): { step: RouteStep; distanceToTurn: number } | null {
  const currentStep = getCurrentStep(route, driverLocation, completedSteps);
  
  if (!currentStep) {
    return null;
  }
  
  // Find the next step with a maneuver (turn)
  const currentStepIndex = route.steps.findIndex(s => s === currentStep);
  
  for (let i = currentStepIndex; i < route.steps.length; i++) {
    const step = route.steps[i];
    
    // Check if this step has a maneuver
    if (step.maneuver && step.maneuver !== "straight") {
      // Calculate distance from driver to this turn
      const distanceToTurn = calculateDistance(driverLocation, step.start_location);
      
      return {
        step,
        distanceToTurn,
      };
    }
  }
  
  // If no turn found, return distance to destination
  const lastStep = route.steps[route.steps.length - 1];
  const distanceToDestination = calculateDistance(driverLocation, lastStep.end_location);
  
  return {
    step: lastStep,
    distanceToTurn: distanceToDestination,
  };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in meters
 */
function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.latitude)) *
      Math.cos(toRad(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Decode polyline string to array of coordinates
 */
export function decodePolyline(encoded: string): Coordinate[] {
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  
  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    
    poly.push({
      latitude: lat * 1e-5,
      longitude: lng * 1e-5,
    });
  }
  
  return poly;
}

/**
 * Clear route cache
 */
export function clearRouteCache(): void {
  routeCache.clear();
}

