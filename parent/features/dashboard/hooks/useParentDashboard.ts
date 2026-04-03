import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getParentData } from "@/lib/auth";
import {
  buildRecentActivities,
  DashboardActivityItem,
  DashboardTrip,
  fetchParentStudents,
  fetchStudentTrip,
  ParentStudent,
} from "@/features/dashboard/services/dashboard.service";

const TRIP_REFRESH_MS = 30000;

export interface ParentDashboardState {
  parentFirstName: string;
  parentAvatarUrl?: string;
  students: ParentStudent[];
  tripsByStudent: Map<string, DashboardTrip>;
  recentActivities: DashboardActivityItem[];
  loading: boolean;
  refreshing: boolean;
  loadingTrips: boolean;
  refresh: () => Promise<void>;
}

export const useParentDashboard = (): ParentDashboardState => {
  const [parentFirstName, setParentFirstName] = useState("Parent");
  const [parentAvatarUrl, setParentAvatarUrl] = useState<string | undefined>();
  const [students, setStudents] = useState<ParentStudent[]>([]);
  const [tripsByStudent, setTripsByStudent] = useState<Map<string, DashboardTrip>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const studentsRef = useRef<ParentStudent[]>([]);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const focusedRef = useRef(true);
  const fetchingTripsRef = useRef(false);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  const fetchTrips = useCallback(async () => {
    if (!focusedRef.current || fetchingTripsRef.current) return;
    const currentStudents = studentsRef.current;
    if (!currentStudents.length) {
      setTripsByStudent(new Map());
      setLoadingTrips(false);
      return;
    }

    try {
      fetchingTripsRef.current = true;
      setLoadingTrips(true);
      const entries = await Promise.all(
        currentStudents.map(async (student) => {
          const trip = await fetchStudentTrip(student.id);
          return [student.id, trip] as const;
        })
      );

      const nextMap = new Map<string, DashboardTrip>();
      entries.forEach(([studentId, trip]) => {
        if (trip) nextMap.set(studentId, trip);
      });
      setTripsByStudent(nextMap);
    } finally {
      fetchingTripsRef.current = false;
      setLoadingTrips(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const [parentData, studentsData] = await Promise.all([
        getParentData(),
        fetchParentStudents(),
      ]);
      setStudents(studentsData);
      setParentFirstName(
        parentData?.firstName || parentData?.name?.split(" ")?.[0] || "Parent"
      );
      setParentAvatarUrl(parentData?.avatar || parentData?.profilePhoto || undefined);
      await fetchTrips();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchTrips]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      if (pollRef.current) clearInterval(pollRef.current);
      fetchTrips();
      pollRef.current = setInterval(fetchTrips, TRIP_REFRESH_MS);
      return () => {
        focusedRef.current = false;
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }, [fetchTrips])
  );

  const recentActivities = useMemo(
    () => buildRecentActivities(students, tripsByStudent),
    [students, tripsByStudent]
  );

  return {
    parentFirstName,
    parentAvatarUrl,
    students,
    tripsByStudent,
    recentActivities,
    loading,
    refreshing,
    loadingTrips,
    refresh,
  };
};
