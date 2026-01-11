/**
 * Hook for fetching and managing trip data with periodic polling
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Trip, TripComparison } from "../types";
import { fetchTripDetails } from "../services/trip.service";
import { TRIP_POLLING_INTERVAL } from "../constants";

/**
 * Options for useTripData hook
 */
export interface UseTripDataOptions {
  studentId: string | string[] | undefined;
  enabled?: boolean;
  pollingInterval?: number;
}

/**
 * Return type for useTripData hook
 */
export interface UseTripDataReturn {
  trip: Trip | null;
  loading: boolean;
  error: Error | null;
  refetch: (silent?: boolean) => Promise<void>;
  comparison: TripComparison | null;
}

/**
 * Compare two trips to determine if update is needed
 */
function compareTrips(
  prevTrip: Trip | null,
  newTrip: Trip
): TripComparison {
  const tripIdChanged = prevTrip?.id !== newTrip.id;
  const pointsLengthChanged =
    (prevTrip?.points?.length || 0) !== (newTrip.points?.length || 0);
  const reachedAtChanged =
    prevTrip?.studentPoint?.reachedAt !== newTrip.studentPoint?.reachedAt;
  const currentPointIndexChanged =
    (prevTrip?.progress?.currentPointIndex ?? 0) !==
    (newTrip.progress?.currentPointIndex ?? 0);

  // Check if points data actually changed (compare IDs and reachedAt)
  const prevPointsKey = prevTrip?.points
    ? prevTrip.points.map((p) => `${p.id}:${p.reachedAt || ""}`).join(",")
    : "";
  const newPointsKey = newTrip.points
    ? newTrip.points.map((p) => `${p.id}:${p.reachedAt || ""}`).join(",")
    : "";
  const pointsDataChanged = prevPointsKey !== newPointsKey;

  const shouldUpdate =
    tripIdChanged ||
    pointsLengthChanged ||
    reachedAtChanged ||
    currentPointIndexChanged ||
    pointsDataChanged ||
    !prevTrip;

  return {
    tripIdChanged,
    pointsLengthChanged,
    reachedAtChanged,
    currentPointIndexChanged,
    pointsDataChanged,
    shouldUpdate,
  };
}

/**
 * Hook to fetch trip data with periodic polling
 */
export function useTripData({
  studentId,
  enabled = true,
  pollingInterval = TRIP_POLLING_INTERVAL,
}: UseTripDataOptions): UseTripDataReturn {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [comparison, setComparison] = useState<TripComparison | null>(null);

  const tripRef = useRef<Trip | null>(null);
  const isFetchingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const normalizedStudentId = Array.isArray(studentId)
    ? studentId[0]
    : studentId;

  const refetch = useCallback(
    async (silent: boolean = false) => {
      if (!normalizedStudentId || !enabled) {
        return;
      }

      // Prevent concurrent fetches
      if (isFetchingRef.current && !silent) {
        return;
      }

      isFetchingRef.current = true;
      try {
        if (!silent) {
          setLoading(true);
        }

        const newTrip = await fetchTripDetails(normalizedStudentId);

        if (newTrip) {
          const prevTrip = tripRef.current;
          const comp = compareTrips(prevTrip, newTrip);

          setComparison(comp);

          // Update ref before state update
          tripRef.current = newTrip;

          // Only update state if data actually changed
          if (comp.shouldUpdate) {
            setTrip(newTrip);
          }
        } else {
          // Trip not found or no active trip
          if (tripRef.current) {
            setTrip(null);
            tripRef.current = null;
          }
        }

        setError(null);
      } catch (err: any) {
        console.error("[useTripData] Error fetching trip:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        isFetchingRef.current = false;
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [normalizedStudentId, enabled]
  );

  // Update ref when trip state changes
  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);

  // Initial fetch and polling setup
  useEffect(() => {
    if (!normalizedStudentId || !enabled) {
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Initial fetch
    refetch(false);

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      refetch(true); // Silent refresh
    }, pollingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [normalizedStudentId, enabled, pollingInterval, refetch]);

  return {
    trip,
    loading,
    error,
    refetch,
    comparison,
  };
}

