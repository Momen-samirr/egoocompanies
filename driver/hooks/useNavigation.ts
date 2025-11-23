import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import {
  calculateRoute,
  recalculateRoute,
  getNextTurnInstruction,
  Route,
  Coordinate,
  RouteStep,
} from "@/services/navigationService";
import { checkRouteDeviation, checkArrival } from "@/utils/routeDeviation";
import { calculateBearing, calculateHeadingFromMovement, Coordinate as NavCoordinate } from "@/utils/navigation.utils";

export type NavigationMode = "pickup" | "destination" | null;

export interface NavigationState {
  isActive: boolean;
  mode: NavigationMode;
  route: Route | null;
  currentStep: RouteStep | null;
  nextTurn: { step: RouteStep; distanceToTurn: number } | null;
  currentLocation: Coordinate | null;
  driverHeading: number | null;
  bearingToDestination: number | null;
  distanceToDestination: number;
  etaToDestination: number; // in minutes
  isDeviated: boolean;
  distanceFromRoute: number;
  isLoading: boolean;
  error: string | null;
}

export interface UseNavigationOptions {
  origin: Coordinate | null;
  destination: Coordinate | null;
  mode: NavigationMode;
  enabled: boolean;
  onArrival?: () => void;
  onDeviation?: () => void;
}

export interface UseNavigationReturn {
  state: NavigationState;
  startNavigation: () => Promise<void>;
  stopNavigation: () => void;
  recalculateCurrentRoute: () => Promise<void>;
}

const DEVIATION_THRESHOLD = 50; // meters
const ARRIVAL_THRESHOLD = 50; // meters
const ROUTE_CHECK_INTERVAL = 5000; // 5 seconds
const RECALCULATION_DEBOUNCE = 30000; // 30 seconds

export function useNavigation(
  options: UseNavigationOptions
): UseNavigationReturn {
  const { origin, destination, mode, enabled, onArrival, onDeviation } = options;

  const [state, setState] = useState<NavigationState>({
    isActive: false,
    mode: null,
    route: null,
    currentStep: null,
    nextTurn: null,
    currentLocation: null,
    driverHeading: null,
    bearingToDestination: null,
    distanceToDestination: 0,
    etaToDestination: 0,
    isDeviated: false,
    distanceFromRoute: 0,
    isLoading: false,
    error: null,
  });

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const routeCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const lastRecalculationTime = useRef<number>(0);
  const previousLocation = useRef<Coordinate | null>(null);
  const completedSteps = useRef<number[]>([]);
  const stateRef = useRef<NavigationState>(state);
  
  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Start location tracking
  const startLocationTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState((prev) => ({
          ...prev,
          error: "Location permission denied",
        }));
        return;
      }

      // Get initial location
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const initialCoord: Coordinate = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
      };

      setState((prev) => ({
        ...prev,
        currentLocation: initialCoord,
      }));

      previousLocation.current = initialCoord;

      // Watch position updates
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000, // 2 seconds during navigation
          distanceInterval: 5, // 5 meters
          mayShowUserSettingsDialog: true,
        },
        (position) => {
          const newLocation: Coordinate = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          // Update location
          setState((prev) => ({
            ...prev,
            currentLocation: newLocation,
          }));

          // Update heading
          let heading: number | null = null;
          if (position.coords.heading !== null && position.coords.heading !== undefined && position.coords.heading >= 0) {
            heading = position.coords.heading;
          } else if (previousLocation.current) {
            // Calculate heading from movement
            const calculatedHeading = calculateHeadingFromMovement(
              previousLocation.current as NavCoordinate,
              newLocation as NavCoordinate
            );
            if (calculatedHeading !== null) {
              heading = calculatedHeading;
            }
          }

          setState((prev) => ({
            ...prev,
            driverHeading: heading,
          }));

          previousLocation.current = newLocation;
        }
      );
    } catch (error: any) {
      console.error("❌ Error starting location tracking:", error);
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to start location tracking",
      }));
    }
  }, []);

  // Stop location tracking
  const stopLocationTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    previousLocation.current = null;
  }, []);

  // Calculate initial route
  const calculateInitialRoute = useCallback(async () => {
    if (!origin || !destination) {
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const route = await calculateRoute(origin, destination);

      if (!route) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to calculate route",
        }));
        return;
      }

      // Validate route has required properties
      if (!route.distance || !route.distance.value || !route.duration || !route.duration.value) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Invalid route data received",
        }));
        return;
      }

      // Calculate initial bearing and distance
      const bearing = calculateBearing(origin as NavCoordinate, destination as NavCoordinate);
      const distance = route.distance.value / 1000; // Convert to km
      const eta = route.duration.value / 60; // Convert to minutes

      // Get initial turn instruction
      const nextTurn = getNextTurnInstruction(route, origin, []);

      setState((prev) => ({
        ...prev,
        route,
        currentStep: route.steps && route.steps.length > 0 ? route.steps[0] : null,
        nextTurn,
        bearingToDestination: bearing,
        distanceToDestination: distance,
        etaToDestination: eta,
        isLoading: false,
      }));

      completedSteps.current = [];
    } catch (error: any) {
      console.error("❌ Error calculating route:", error);
      console.error("❌ Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      let errorMessage = "Failed to calculate route";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.error_message) {
        errorMessage = error.response.data.error_message;
      } else if (error.response?.status) {
        errorMessage = `Route calculation failed (Status: ${error.response.status})`;
      }
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [origin, destination]);

  // Check route deviation and update navigation state
  const checkRouteStatus = useCallback(async () => {
    const currentState = stateRef.current;
    if (!currentState.route || !currentState.currentLocation || !destination) {
      return;
    }

    // Check if driver has arrived
    const arrival = checkArrival(currentState.currentLocation, destination, ARRIVAL_THRESHOLD);
    if (arrival.isArrived) {
      console.log("✅ Arrived at destination");
      if (onArrival) {
        onArrival();
      }
      return;
    }

    // Check route deviation
    const deviation = checkRouteDeviation(
      currentState.currentLocation,
      currentState.route.overview_polyline.points,
      DEVIATION_THRESHOLD
    );

    setState((prev) => ({
      ...prev,
      isDeviated: deviation.isDeviated,
      distanceFromRoute: deviation.distanceFromRoute,
    }));

    // Recalculate route if deviated and enough time has passed
    if (deviation.isDeviated) {
      const now = Date.now();
      if (now - lastRecalculationTime.current > RECALCULATION_DEBOUNCE) {
        console.log("🔄 Driver deviated, recalculating route...");
        lastRecalculationTime.current = now;

        try {
          const newRoute = await recalculateRoute(
            currentState.currentLocation,
            destination
          );

          if (newRoute) {
            // Validate route has required properties
            if (!newRoute.distance || !newRoute.distance.value || !newRoute.duration || !newRoute.duration.value) {
              console.error("❌ Invalid route data in recalculation");
              return;
            }

            // Update bearing and distance
            const bearing = calculateBearing(
              currentState.currentLocation as NavCoordinate,
              destination as NavCoordinate
            );
            const distance = newRoute.distance.value / 1000;
            const eta = newRoute.duration.value / 60;

            const nextTurn = getNextTurnInstruction(newRoute, currentState.currentLocation, completedSteps.current);

            setState((prev) => ({
              ...prev,
              route: newRoute,
              currentStep: newRoute.steps && newRoute.steps.length > 0 ? newRoute.steps[0] : null,
              nextTurn,
              bearingToDestination: bearing,
              distanceToDestination: distance,
              etaToDestination: eta,
              isDeviated: false,
            }));

            if (onDeviation) {
              onDeviation();
            }
          }
        } catch (error: any) {
          console.error("❌ Error recalculating route:", error);
        }
      }
    } else {
      // Update navigation state (bearing, distance, ETA, next turn)
      if (currentState.currentLocation) {
        const bearing = calculateBearing(
          currentState.currentLocation as NavCoordinate,
          destination as NavCoordinate
        );

        // Get next turn instruction
        const nextTurn = getNextTurnInstruction(
          currentState.route,
          currentState.currentLocation,
          completedSteps.current
        );

        // Estimate remaining distance and ETA
        // Use route distance minus distance traveled
        if (!currentState.route.distance || !currentState.route.distance.value || 
            !currentState.route.duration || !currentState.route.duration.value) {
          return; // Skip update if route data is invalid
        }
        
        const remainingDistance = currentState.route.distance.value / 1000;
        const remainingEta = currentState.route.duration.value / 60;

        setState((prev) => ({
          ...prev,
          bearingToDestination: bearing,
          nextTurn,
          distanceToDestination: remainingDistance,
          etaToDestination: remainingEta,
        }));
      }
    }
  }, [destination, onArrival, onDeviation]);

  // Start navigation
  const startNavigation = useCallback(async () => {
    if (!origin || !destination) {
      setState((prev) => ({
        ...prev,
        error: "Origin and destination are required",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isActive: true,
      mode,
      error: null,
    }));

    // Start location tracking
    await startLocationTracking();

    // Calculate initial route
    await calculateInitialRoute();

    // Start route checking interval
    routeCheckInterval.current = setInterval(() => {
      checkRouteStatus();
    }, ROUTE_CHECK_INTERVAL);
  }, [origin, destination, mode, startLocationTracking, calculateInitialRoute, checkRouteStatus]);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    stopLocationTracking();

    if (routeCheckInterval.current) {
      clearInterval(routeCheckInterval.current);
      routeCheckInterval.current = null;
    }

    setState((prev) => ({
      ...prev,
      isActive: false,
      mode: null,
      route: null,
      currentStep: null,
      nextTurn: null,
      isDeviated: false,
    }));

    completedSteps.current = [];
    lastRecalculationTime.current = 0;
  }, [stopLocationTracking]);

  // Recalculate route manually
  const recalculateCurrentRoute = useCallback(async () => {
    if (!state.currentLocation || !destination) {
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const newRoute = await recalculateRoute(state.currentLocation, destination);

      if (newRoute) {
        // Validate route has required properties
        if (!newRoute.distance || !newRoute.distance.value || !newRoute.duration || !newRoute.duration.value) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: "Invalid route data received",
          }));
          return;
        }

        const bearing = calculateBearing(
          state.currentLocation as NavCoordinate,
          destination as NavCoordinate
        );
        const distance = newRoute.distance.value / 1000;
        const eta = newRoute.duration.value / 60;

        const nextTurn = getNextTurnInstruction(newRoute, state.currentLocation, completedSteps.current);

        setState((prev) => ({
          ...prev,
          route: newRoute,
          currentStep: newRoute.steps && newRoute.steps.length > 0 ? newRoute.steps[0] : null,
          nextTurn,
          bearingToDestination: bearing,
          distanceToDestination: distance,
          etaToDestination: eta,
          isLoading: false,
        }));

        completedSteps.current = [];
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to recalculate route",
        }));
      }
    } catch (error: any) {
      console.error("❌ Error recalculating route:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Failed to recalculate route",
      }));
    }
  }, [state.currentLocation, destination]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopNavigation();
    };
  }, [stopNavigation]);

  // Auto-start navigation when enabled
  useEffect(() => {
    if (enabled && origin && destination && !state.isActive) {
      startNavigation();
    } else if (!enabled && state.isActive) {
      stopNavigation();
    }
  }, [enabled, origin, destination, state.isActive, startNavigation, stopNavigation]);

  return {
    state,
    startNavigation,
    stopNavigation,
    recalculateCurrentRoute,
  };
}

