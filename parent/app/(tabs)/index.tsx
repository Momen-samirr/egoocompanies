import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";
import { getParentData } from "@/lib/auth";
import { useNotifications } from "@/hooks/useNotifications";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade?: string;
  school: {
    id: string;
    name: string;
  };
  stop?: {
    id: string;
    name: string;
  };
  relationship?: string;
  isPrimary?: boolean;
}

export default function HomeScreen() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTrips, setActiveTrips] = useState<Map<string, any>>(new Map());
  const checkTripsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingTripsRef = useRef(false);
  const studentsRef = useRef<Student[]>([]);
  const lastStudentCountRef = useRef<number>(0);
  const activeTripsRef = useRef<Map<string, any>>(new Map());
  const isScreenFocusedRef = useRef(true);
  
  // Update ref when activeTrips changes
  useEffect(() => {
    activeTripsRef.current = activeTrips;
  }, [activeTrips]);
  
  // Pause interval when screen is not focused (user navigated away)
  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;
      return () => {
        isScreenFocusedRef.current = false;
        // Clear interval when screen loses focus
        if (checkTripsIntervalRef.current) {
          clearInterval(checkTripsIntervalRef.current);
          checkTripsIntervalRef.current = null;
        }
      };
    }, [])
  );

  // #region agent log
  console.log('[DEBUG] HomeScreen: Component render/re-render', { 
    timestamp: new Date().toISOString(),
    renderCount: (global as any).__homeScreenRenderCount = ((global as any).__homeScreenRenderCount || 0) + 1
  });
  // #endregion

  // Register for push notifications
  useNotifications();

  useEffect(() => {
    // #region agent log
    console.log('[DEBUG] HomeScreen: Initial mount - calling fetchStudents');
    // #endregion
    fetchStudents();
  }, []);

  // Update ref when students change
  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    // #region agent log
    const effectRunId = Date.now();
    const prevStudentCount = lastStudentCountRef.current;
    const currentStudentCount = students.length;
    const studentCountChanged = prevStudentCount !== currentStudentCount;
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:67',message:'checkActiveTrips effect triggered',data:{effectRunId,prevStudentCount,currentStudentCount,studentCountChanged,hasInterval:!!checkTripsIntervalRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'home-effect-trigger',hypothesisId:'I'})}).catch(()=>{});
    // #endregion
    
    // Check for active trips for each student
    const checkActiveTrips = async () => {
      // Prevent concurrent executions
      if (isCheckingTripsRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:69',message:'checkActiveTrips: Skipped - already checking',data:{effectRunId},timestamp:Date.now(),sessionId:'debug-session',runId:'check-skipped',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        return;
      }
      
      const currentStudents = studentsRef.current;
      if (currentStudents.length === 0) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:75',message:'checkActiveTrips: Skipped - no students',data:{effectRunId},timestamp:Date.now(),sessionId:'debug-session',runId:'check-skipped-no-students',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        return;
      }
      
      // Skip if screen is not focused (user navigated away)
      if (!isScreenFocusedRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:93',message:'checkActiveTrips: Skipped - screen not focused',data:{effectRunId},timestamp:Date.now(),sessionId:'debug-session',runId:'check-skipped-not-focused',hypothesisId:'R'})}).catch(()=>{});
        // #endregion
        return;
      }

      isCheckingTripsRef.current = true;
      
      try {
        // #region agent log
        const checkId = Date.now();
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:83',message:'checkActiveTrips: Starting',data:{checkId,effectRunId,studentCount:currentStudents.length,studentIds:currentStudents.map(s => s.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'check-start',hypothesisId:'K'})}).catch(()=>{});
        // #endregion
        const trips = new Map();
        for (const student of currentStudents) {
          try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:88',message:'checkActiveTrips: API call starting',data:{checkId,studentId:student.id,studentName:`${student.firstName} ${student.lastName}`},timestamp:Date.now(),sessionId:'debug-session',runId:'api-call-start',hypothesisId:'L'})}).catch(()=>{});
            // #endregion
            const response = await api.get(`/parent/students/${student.id}/trip`);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:92',message:'checkActiveTrips: API response received',data:{checkId,studentId:student.id,status:response.status,success:response.data?.success,hasTrip:!!response.data?.trip,tripId:response.data?.trip?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'api-response',hypothesisId:'L'})}).catch(()=>{});
            // #endregion
            if (response.data.success && response.data.trip) {
              trips.set(student.id, response.data.trip);
            }
          } catch (error: any) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:119',message:'checkActiveTrips: API error',data:{checkId,studentId:student.id,errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'api-error',hypothesisId:'L'})}).catch(()=>{});
            // #endregion
          }
        }
        // #region agent log
        const prevTrips = activeTripsRef.current;
        const prevTripsSize = prevTrips.size;
        const newTripsSize = trips.size;
        // Compare trip data to see if it actually changed
        const tripsChanged = prevTripsSize !== newTripsSize || Array.from(trips.keys()).some(id => {
          const prevTrip = prevTrips.get(id);
          const newTrip = trips.get(id);
          return !prevTrip || prevTrip.id !== newTrip?.id || prevTrip.status !== newTrip?.status;
        });
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:131',message:'checkActiveTrips: Completed - about to setActiveTrips',data:{checkId,effectRunId,tripsFound:trips.size,tripStudentIds:Array.from(trips.keys()),prevTripsSize,newTripsSize,tripsChanged},timestamp:Date.now(),sessionId:'debug-session',runId:'check-completed',hypothesisId:'M'})}).catch(()=>{});
        // #endregion
        // Only update state if trip data actually changed to prevent unnecessary re-renders
        if (tripsChanged) {
          setActiveTrips(trips);
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:134',message:'checkActiveTrips: Skipping setActiveTrips - no changes',data:{checkId,effectRunId},timestamp:Date.now(),sessionId:'debug-session',runId:'check-skip-update',hypothesisId:'M'})}).catch(()=>{});
          // #endregion
        }
      } finally {
        isCheckingTripsRef.current = false;
      }
    };

    // Only re-initialize if student count actually changed AND we don't already have an interval
    if (students.length !== lastStudentCountRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:140',message:'checkActiveTrips effect: Student count changed - reinitializing',data:{effectRunId,prevStudentCount,currentStudentCount,hasExistingInterval:!!checkTripsIntervalRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'effect-reinit',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
      lastStudentCountRef.current = students.length;
      
      // Clear any existing interval before setting up a new one
      if (checkTripsIntervalRef.current) {
        clearInterval(checkTripsIntervalRef.current);
        checkTripsIntervalRef.current = null;
      }

      if (students.length > 0 && isScreenFocusedRef.current) {
        // Initial check
        checkActiveTrips();
        // Set up interval for periodic checks (only one interval should exist)
        // Double-check we don't already have an interval
        if (!checkTripsIntervalRef.current) {
          checkTripsIntervalRef.current = setInterval(checkActiveTrips, 30000); // Check every 30 seconds
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:154',message:'checkActiveTrips effect: Interval set up',data:{effectRunId,intervalSet:true,intervalId:checkTripsIntervalRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'interval-setup',hypothesisId:'O'})}).catch(()=>{});
          // #endregion
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:157',message:'checkActiveTrips effect: Interval already exists - skipping setup',data:{effectRunId,existingIntervalId:checkTripsIntervalRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'interval-skip',hypothesisId:'S'})}).catch(()=>{});
          // #endregion
        }
      }
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:156',message:'checkActiveTrips effect: Student count unchanged - skipping reinit',data:{effectRunId,prevStudentCount,currentStudentCount,hasInterval:!!checkTripsIntervalRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'effect-skip',hypothesisId:'P'})}).catch(()=>{});
      // #endregion
    }

    // Cleanup function
    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:159',message:'checkActiveTrips effect: Cleanup',data:{effectRunId,clearingInterval:!!checkTripsIntervalRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'effect-cleanup',hypothesisId:'Q'})}).catch(()=>{});
      // #endregion
      if (checkTripsIntervalRef.current) {
        clearInterval(checkTripsIntervalRef.current);
        checkTripsIntervalRef.current = null;
      }
    };
  }, [students.length]); // Only re-run when student count changes

  const fetchStudents = async () => {
    // #region agent log
    console.log('[DEBUG] fetchStudents: Called', { 
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
    // #endregion
    try {
      setLoading(true);
      const response = await api.get("/parent/students");
      if (response.data.success) {
        setStudents(response.data.students || []);
      }
    } catch (error: any) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    // #region agent log
    console.log('[DEBUG] onRefresh: User pulled to refresh - calling fetchStudents');
    // #endregion
    setRefreshing(true);
    fetchStudents();
  };

  const handleTrackTrip = (student: Student, trip: any) => {
    router.push({
      pathname: "/(routes)/track-trip",
      params: {
        studentId: student.id,
        tripId: trip.id,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Students</Text>
        <Text style={styles.subtitle}>
          Track your children's school transportation
        </Text>
      </View>

      {students.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="school-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>No students linked</Text>
          <Text style={styles.emptySubtext}>
            Contact your school to link your account to students
          </Text>
        </View>
      ) : (
        <View style={styles.studentsList}>
          {students.map((student) => {
            const activeTrip = activeTrips.get(student.id);
            return (
              <View key={student.id} style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <View style={styles.studentInfo}>
                    <Ionicons
                      name="person-circle-outline"
                      size={40}
                      color="#6366f1"
                    />
                    <View style={styles.studentDetails}>
                      <Text style={styles.studentName}>
                        {student.firstName} {student.lastName}
                      </Text>
                      <Text style={styles.schoolName}>
                        {student.school.name}
                        {student.grade && ` • ${student.grade}`}
                      </Text>
                      {student.stop && (
                        <Text style={styles.stopName}>
                          📍 {student.stop.name}
                        </Text>
                      )}
                    </View>
                  </View>
                  {student.isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryText}>Primary</Text>
                    </View>
                  )}
                </View>

                {activeTrip ? (
                  <View style={styles.tripCard}>
                    <View style={styles.tripHeader}>
                      <Ionicons 
                        name={activeTrip.status === "ACTIVE" ? "car" : "time-outline"} 
                        size={20} 
                        color={activeTrip.status === "ACTIVE" ? "#10b981" : "#6366f1"} 
                      />
                      <Text style={[
                        styles.tripStatus,
                        activeTrip.status === "SCHEDULED" && styles.tripStatusScheduled
                      ]}>
                        {activeTrip.status === "ACTIVE" ? "Active Trip" : "Scheduled Trip"}
                      </Text>
                    </View>
                    <Text style={styles.tripName}>{activeTrip.name}</Text>
                    {activeTrip.studentPoint && activeTrip.studentPoint.stopId === student.stop?.id && (
                      <View style={styles.stopIncludedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                        <Text style={styles.stopIncludedText}>Stop included</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.trackButton}
                      onPress={() => handleTrackTrip(student, activeTrip)}
                    >
                      <Text style={styles.trackButtonText}>
                        {activeTrip.status === "ACTIVE" ? "Track Trip" : "View Trip"}
                      </Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.noTripCard}>
                    <Text style={styles.noTripText}>No active trip</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 10,
  },
  studentsList: {
    padding: 15,
  },
  studentCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  studentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  studentInfo: {
    flexDirection: "row",
    flex: 1,
  },
  studentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  schoolName: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  stopName: {
    fontSize: 13,
    color: "#6366f1",
    marginTop: 4,
  },
  primaryBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  primaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e40af",
  },
  tripCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  tripHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tripStatus: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10b981",
    marginLeft: 6,
  },
  tripStatusScheduled: {
    color: "#6366f1",
  },
  tripName: {
    fontSize: 14,
    color: "#166534",
    marginBottom: 10,
  },
  stopIncludedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d1fae5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#10b981",
  },
  stopIncludedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#065f46",
    marginLeft: 6,
  },
  trackButton: {
    backgroundColor: "#6366f1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
  },
  trackButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  noTripCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
  },
  noTripText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
});

