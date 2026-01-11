/**
 * Trip data service
 * Handles API calls for fetching trip details
 */

import api from "@/lib/api";
import { Trip, TripApiResponse } from "../types";

/**
 * Transform raw API response to Trip type
 */
function transformTripResponse(data: any): Trip {
  return {
    id: data.id,
    name: data.name || "",
    status: data.status || "UNKNOWN",
    assignedCaptain: data.assignedCaptain || null,
    points: (data.points || []).map((p: any) => ({
      id: p.id,
      name: p.name || "",
      latitude: p.latitude,
      longitude: p.longitude,
      order: p.order || 0,
      stopId: p.stopId,
      reachedAt: p.reachedAt || null,
    })),
    progress: data.progress
      ? {
          currentPointIndex: data.progress.currentPointIndex || 0,
          status: data.progress.status || "",
        }
      : null,
    studentPoint: data.studentPoint
      ? {
          id: data.studentPoint.id,
          name: data.studentPoint.name || "",
          latitude: data.studentPoint.latitude,
          longitude: data.studentPoint.longitude,
          order: data.studentPoint.order || 0,
          stopId: data.studentPoint.stopId,
          reachedAt: data.studentPoint.reachedAt || null,
        }
      : null,
    route: data.route
      ? {
          id: data.route.id,
          name: data.route.name || "",
          school: data.route.school
            ? {
                id: data.route.school.id,
                name: data.route.school.name || "",
              }
            : undefined,
        }
      : undefined,
  };
}

/**
 * Fetch trip details for a student
 */
export async function fetchTripDetails(studentId: string): Promise<Trip | null> {
  try {
    const response = await api.get<TripApiResponse>(
      `/parent/students/${studentId}/trip`
    );

    if (response.data.success && response.data.trip) {
      return transformTripResponse(response.data.trip);
    }

    return null;
  } catch (error: any) {
    console.error("[Trip Service] Error fetching trip details:", error);
    throw error;
  }
}

