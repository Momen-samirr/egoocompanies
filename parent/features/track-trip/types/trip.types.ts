/**
 * Trip-related types for track-trip feature
 */

import { Coordinate } from "./location.types";

/**
 * Trip point (stop) in the route
 */
export interface TripPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  stopId?: string;
  reachedAt?: string | null;
}

/**
 * Trip progress information
 */
export interface TripProgress {
  currentPointIndex: number;
  status: string;
}

/**
 * Driver/Captain information
 */
export interface AssignedCaptain {
  id: string;
  name: string;
  phone_number?: string;
  selfiePhoto?: string;
  vehicle_type?: string;
  registration_number?: string;
  vehicle_color?: string;
  ratings?: number;
}

/**
 * Complete trip data structure
 */
export interface Trip {
  id: string;
  name: string;
  status: string;
  assignedCaptain?: AssignedCaptain | null;
  points: TripPoint[];
  progress?: TripProgress | null;
  studentPoint?: TripPoint | null;
  route?: {
    id: string;
    name: string;
    school?: {
      id: string;
      name: string;
    };
  };
}

/**
 * Route segment for visualization
 */
export interface RouteSegment {
  index: number;
  start: Coordinate;
  end: Coordinate;
  isCompleted: boolean;
  isCurrent: boolean;
}

/**
 * API response for trip details
 */
export interface TripApiResponse {
  success: boolean;
  trip: Trip | null;
  message?: string;
}

/**
 * Trip data comparison result
 */
export interface TripComparison {
  tripIdChanged: boolean;
  pointsLengthChanged: boolean;
  reachedAtChanged: boolean;
  currentPointIndexChanged: boolean;
  pointsDataChanged: boolean;
  shouldUpdate: boolean;
}

