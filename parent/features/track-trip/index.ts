/**
 * Main export for track-trip feature module
 */

export { TripTrackingScreen as default } from "./components/TripTrackingScreen";
export { TripTrackingScreen } from "./components/TripTrackingScreen";

// Export hooks for external use if needed
export { useTripTracking } from "./hooks/useTripTracking";
export { useTripData } from "./hooks/useTripData";
export { useDriverLocation } from "./hooks/useDriverLocation";
export { useMapRegion } from "./hooks/useMapRegion";
export { useETA } from "./hooks/useETA";

// Export types
export * from "./types";

// Export services (for testing or advanced use cases)
export { WebSocketService } from "./services/websocket.service";
export { fetchTripDetails } from "./services/trip.service";
export { calculateETA } from "./services/eta.service";
export { calculateMapRegion } from "./services/map.service";

// Export utilities
export * from "./utils/coordinates";
export * from "./utils/validation";
export * from "./utils/debounce";

// Export constants
export * from "./constants";

