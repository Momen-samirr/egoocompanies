import { Coordinate } from "@/services/navigationService";
import MapView from "react-native-maps";

export interface CameraPosition {
  center: Coordinate;
  heading: number; // 0-360 degrees
  pitch: number; // 0-90 degrees
  zoom: number; // Map zoom level
}

/**
 * Calculate optimal zoom level based on distance
 */
export function calculateZoomLevel(distanceInMeters: number): number {
  // Closer distances = higher zoom (smaller delta)
  // Further distances = lower zoom (larger delta)
  
  if (distanceInMeters < 100) {
    return 0.002; // Very close - high zoom
  } else if (distanceInMeters < 500) {
    return 0.005; // Close - medium-high zoom
  } else if (distanceInMeters < 2000) {
    return 0.01; // Medium - medium zoom
  } else if (distanceInMeters < 5000) {
    return 0.02; // Far - low zoom
  } else {
    return 0.05; // Very far - very low zoom
  }
}

/**
 * Calculate optimal camera position for navigation
 * @param driverLocation Current driver location
 * @param destination Destination location
 * @param driverHeading Driver's heading in degrees (0-360)
 * @param isNavigationMode Whether map should rotate with heading
 */
export function calculateCameraPosition(
  driverLocation: Coordinate,
  destination: Coordinate,
  driverHeading: number | null,
  isNavigationMode: boolean = true
): CameraPosition {
  // Calculate distance to destination
  const distance = calculateDistance(driverLocation, destination);
  
  // Calculate zoom based on distance
  const zoom = calculateZoomLevel(distance);
  
  // Calculate center point (between driver and destination, but closer to driver)
  const centerLat = driverLocation.latitude + (destination.latitude - driverLocation.latitude) * 0.3;
  const centerLng = driverLocation.longitude + (destination.longitude - driverLocation.longitude) * 0.3;
  
  // In navigation mode, rotate map based on heading
  // Otherwise, keep map oriented north
  const heading = isNavigationMode && driverHeading !== null ? driverHeading : 0;
  
  return {
    center: {
      latitude: centerLat,
      longitude: centerLng,
    },
    heading,
    pitch: isNavigationMode ? 45 : 0, // Tilt map slightly in navigation mode
    zoom: 0, // Not used with latitudeDelta/longitudeDelta
  };
}

/**
 * Animate map camera to follow driver smoothly
 */
export function animateCameraToDriver(
  mapRef: React.RefObject<MapView>,
  driverLocation: Coordinate,
  destination: Coordinate,
  driverHeading: number | null,
  isNavigationMode: boolean = true
): void {
  if (!mapRef.current) {
    return;
  }

  const cameraPosition = calculateCameraPosition(
    driverLocation,
    destination,
    driverHeading,
    isNavigationMode
  );

  const distance = calculateDistance(driverLocation, destination);
  const zoom = calculateZoomLevel(distance);

  // Use animateToRegion for smooth following
  mapRef.current.animateToRegion(
    {
      latitude: cameraPosition.center.latitude,
      longitude: cameraPosition.center.longitude,
      latitudeDelta: zoom,
      longitudeDelta: zoom,
    },
    1000 // 1 second animation
  );

  // Rotate map if in navigation mode
  if (isNavigationMode && driverHeading !== null) {
    mapRef.current.animateToCamera(
      {
        center: cameraPosition.center,
        heading: driverHeading,
        pitch: cameraPosition.pitch,
        zoom: 18, // Fixed zoom level for camera mode
        altitude: 1000,
      },
      {
        duration: 1000,
      }
    );
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
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
 * Center map on driver location
 */
export function centerMapOnDriver(
  mapRef: React.RefObject<MapView>,
  driverLocation: Coordinate,
  zoom: number = 0.01
): void {
  if (!mapRef.current) {
    return;
  }

  mapRef.current.animateToRegion(
    {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      latitudeDelta: zoom,
      longitudeDelta: zoom,
    },
    500
  );
}

