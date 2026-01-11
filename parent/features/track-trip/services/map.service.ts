/**
 * Map-related utility services
 */

import { Region } from "react-native-maps";
import { Coordinate } from "../types";
import { MAP_REGION_PADDING, DEFAULT_MAP_DELTA } from "../constants";

/**
 * Bounding box for coordinates
 */
export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Calculate bounding box from coordinates
 */
export function calculateBoundingBox(
  coordinates: Coordinate[]
): BoundingBox | null {
  if (coordinates.length === 0) return null;

  const latitudes = coordinates.map((c) => c.latitude);
  const longitudes = coordinates.map((c) => c.longitude);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

/**
 * Add padding to a map region
 */
export function addPaddingToRegion(
  region: Region,
  paddingPercent: number = MAP_REGION_PADDING
): Region {
  const latPadding = (region.latitudeDelta * paddingPercent) / 2;
  const lngPadding = (region.longitudeDelta * paddingPercent) / 2;

  return {
    ...region,
    latitudeDelta: region.latitudeDelta + latPadding * 2,
    longitudeDelta: region.longitudeDelta + lngPadding * 2,
  };
}

/**
 * Calculate map region from trip points and optional driver location
 */
export function calculateMapRegion(
  points: Coordinate[],
  driverLocation?: Coordinate | null
): Region | null {
  const allPoints: Coordinate[] = [...points];
  
  // Add driver location if available
  if (driverLocation) {
    allPoints.push(driverLocation);
  }

  if (allPoints.length === 0) {
    return null;
  }

  const boundingBox = calculateBoundingBox(allPoints);
  if (!boundingBox) {
    return null;
  }

  const latDelta = boundingBox.maxLat - boundingBox.minLat;
  const lngDelta = boundingBox.maxLng - boundingBox.minLng;

  // Add padding
  const padding = MAP_REGION_PADDING;
  const latPadding = latDelta * padding;
  const lngPadding = lngDelta * padding;

  const region: Region = {
    latitude: (boundingBox.minLat + boundingBox.maxLat) / 2,
    longitude: (boundingBox.minLng + boundingBox.maxLng) / 2,
    latitudeDelta: Math.max(latDelta + latPadding * 2, DEFAULT_MAP_DELTA),
    longitudeDelta: Math.max(lngDelta + lngPadding * 2, DEFAULT_MAP_DELTA),
  };

  return region;
}

