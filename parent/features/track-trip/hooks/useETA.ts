/**
 * Hook for calculating ETA to target point
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Trip, Coordinate, ETA } from "../types";
import { calculateETA } from "../services/eta.service";
import {
  hasMovedByDistance,
  hasCoordinateChanged,
} from "../utils/coordinates";
import {
  ETA_DEBOUNCE_DELAY,
  ETA_MIN_DISTANCE_CHANGE,
  GOOGLE_MAPS_API_KEY,
  COORDINATE_CHANGE_THRESHOLD,
} from "../constants";

/**
 * Options for useETA hook
 */
export interface UseETAOptions {
  trip: Trip | null;
  driverLocation: Coordinate | null;
  apiKey?: string;
}

/**
 * Return type for useETA hook
 */
export interface UseETAReturn {
  eta: ETA | null;
  calculating: boolean;
  recalculate: () => Promise<void>;
}

/**
 * Hook to calculate ETA to target point (pickup or drop-off)
 */
export function useETA({
  trip,
  driverLocation,
  apiKey = GOOGLE_MAPS_API_KEY,
}: UseETAOptions): UseETAReturn {
  const [eta, setEta] = useState<ETA | null>(null);
  const [calculating, setCalculating] = useState(false);
  const lastCalculatedLocationRef = useRef<Coordinate | null>(null);
  const lastCalculatedTargetPointIdRef = useRef<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const determineTargetPoint = useCallback((): Coordinate | null => {
    if (!trip) return null;

    const studentPoint = trip.studentPoint || trip.points?.[0];
    if (!studentPoint) return null;

    const allPoints = trip.points || [];
    const currentPointIndex = trip.progress?.currentPointIndex ?? 0;
    const studentPointIndex = studentPoint
      ? allPoints.findIndex((p) => p.id === studentPoint.id)
      : -1;

    // Get actual student point from allPoints to check reachedAt
    const actualStudentPoint =
      studentPointIndex >= 0 ? allPoints[studentPointIndex] : studentPoint;

    // Check if student stop has been reached (valid date string)
    const hasValidReachedAt =
      actualStudentPoint?.reachedAt &&
      typeof actualStudentPoint.reachedAt === "string" &&
      actualStudentPoint.reachedAt.length > 0;

    if (hasValidReachedAt) {
      // Student picked up - show ETA to drop-off (last point)
      return allPoints.length > 0
        ? {
            latitude: allPoints[allPoints.length - 1].latitude,
            longitude: allPoints[allPoints.length - 1].longitude,
          }
        : null;
    } else {
      // Student not picked up - show ETA to pickup (student point)
      return {
        latitude: studentPoint.latitude,
        longitude: studentPoint.longitude,
      };
    }
  }, [trip]);

  const recalculate = useCallback(async () => {
    if (!trip || !driverLocation) {
      setEta(null);
      return;
    }

    const targetPoint = determineTargetPoint();
    if (!targetPoint) {
      setEta(null);
      return;
    }

    // Check if location has changed significantly
    const hasLocationChanged = !lastCalculatedLocationRef.current ||
      hasMovedByDistance(
        lastCalculatedLocationRef.current,
        driverLocation,
        ETA_MIN_DISTANCE_CHANGE
      );

    // Check if target point changed
    const targetPointId =
      trip.studentPoint?.id || trip.points?.[0]?.id || null;
    const hasTargetPointChanged =
      lastCalculatedTargetPointIdRef.current !== targetPointId;

    if (!hasLocationChanged && !hasTargetPointChanged && eta) {
      return; // Skip recalculation
    }

    // Debounce ETA calculation
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      // Double-check location hasn't changed during debounce
      const currentTargetPointId =
        trip.studentPoint?.id || trip.points?.[0]?.id || null;
      if (
        lastCalculatedLocationRef.current &&
        lastCalculatedTargetPointIdRef.current === currentTargetPointId &&
        !hasMovedByDistance(
          lastCalculatedLocationRef.current,
          driverLocation,
          ETA_MIN_DISTANCE_CHANGE
        ) &&
        eta
      ) {
        return;
      }

      setCalculating(true);
      try {
        const calculatedETA = await calculateETA(
          driverLocation,
          targetPoint,
          apiKey
        );
        if (calculatedETA) {
          setEta(calculatedETA);
          lastCalculatedLocationRef.current = { ...driverLocation };
          lastCalculatedTargetPointIdRef.current = currentTargetPointId;
        } else {
          setEta(null);
        }
      } catch (error) {
        console.error("[useETA] Error calculating ETA:", error);
        setEta(null);
      } finally {
        setCalculating(false);
      }
    }, ETA_DEBOUNCE_DELAY);
  }, [trip, driverLocation, apiKey, eta, determineTargetPoint]);

  // Recalculate when dependencies change
  useEffect(() => {
    recalculate();

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    trip?.id,
    trip?.progress?.currentPointIndex,
    trip?.studentPoint?.reachedAt,
    driverLocation?.latitude,
    driverLocation?.longitude,
  ]);

  return {
    eta,
    calculating,
    recalculate,
  };
}

