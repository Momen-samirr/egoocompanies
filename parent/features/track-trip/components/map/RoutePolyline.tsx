/**
 * Route visualization component using MapDirections or Polyline
 */

import React, { useState } from "react";
import { Polyline } from "react-native-maps";
import MapDirections from "react-native-maps-directions";
import { RouteSegment, Coordinate } from "../../types";
import { GOOGLE_MAPS_API_KEY } from "../../constants";

/**
 * Props for RoutePolyline component
 */
export interface RoutePolylineProps {
  segments: RouteSegment[];
  apiKey?: string;
  onError?: (error: Error) => void;
}

/**
 * Route visualization component
 * Uses MapDirections for each segment with fallback to Polyline on error
 */
export function RoutePolyline({
  segments,
  apiKey = GOOGLE_MAPS_API_KEY,
  onError,
}: RoutePolylineProps) {
  const [directionsError, setDirectionsError] = useState(false);

  if (segments.length === 0) {
    return null;
  }

  const handleError = (error: any, segmentIndex: number) => {
    console.warn(`[RoutePolyline] Directions error for segment ${segmentIndex}:`, error);
    if (segmentIndex === 0) {
      setDirectionsError(true);
    }
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Use MapDirections for route visualization
  if (!directionsError) {
    return (
      <>
        {segments.map((segment, idx) => (
          <MapDirections
            key={`route-${segment.index}-${
              segment.isCompleted
                ? "completed"
                : segment.isCurrent
                ? "current"
                : "upcoming"
            }`}
            origin={segment.start}
            destination={segment.end}
            apikey={apiKey}
            strokeWidth={4}
            strokeColor={
              segment.isCompleted
                ? "#9ca3af" // Gray for completed
                : segment.isCurrent
                ? "#6366f1" // Blue for current
                : "#dbeafe" // Light blue for upcoming
            }
            onError={(error) => handleError(error, idx)}
          />
        ))}
      </>
    );
  }

  // Fallback to simple polyline if directions fail
  const allCoordinates: Coordinate[] = segments.flatMap((seg) => [
    seg.start,
    seg.end,
  ]);

  return (
    <Polyline coordinates={allCoordinates} strokeColor="#6366f1" strokeWidth={4} />
  );
}

