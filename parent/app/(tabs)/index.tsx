import { useEffect, useState } from "react";
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

  // Register for push notifications
  useNotifications();

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    // Check for active trips for each student
    const checkActiveTrips = async () => {
      // #region agent log
      console.log('[DEBUG] checkActiveTrips: Starting', { studentCount: students.length, studentIds: students.map(s => s.id) });
      // #endregion
      const trips = new Map();
      for (const student of students) {
        try {
          // #region agent log
          console.log('[DEBUG] checkActiveTrips: Checking trip for student', { studentId: student.id, studentName: `${student.firstName} ${student.lastName}` });
          // #endregion
          const response = await api.get(`/parent/students/${student.id}/trip`);
          // #region agent log
          console.log('[DEBUG] checkActiveTrips: API response received', { 
            studentId: student.id, 
            status: response.status, 
            success: response.data?.success, 
            hasTrip: !!response.data?.trip,
            trip: response.data?.trip ? { id: response.data.trip.id, status: response.data.trip.status, name: response.data.trip.name } : null,
            message: response.data?.message,
            fullResponse: JSON.stringify(response.data)
          });
          // #endregion
          if (response.data.success && response.data.trip) {
            // #region agent log
            console.log('[DEBUG] checkActiveTrips: Adding trip to map', { studentId: student.id, tripId: response.data.trip.id });
            // #endregion
            trips.set(student.id, response.data.trip);
          } else {
            // #region agent log
            console.log('[DEBUG] checkActiveTrips: No trip found or invalid response', { 
              studentId: student.id, 
              success: response.data?.success, 
              hasTrip: !!response.data?.trip,
              message: response.data?.message 
            });
            // #endregion
          }
        } catch (error: any) {
          // #region agent log
          console.error('[DEBUG] checkActiveTrips: Error fetching trip', { 
            studentId: student.id, 
            errorMessage: error?.message, 
            errorResponse: error?.response?.data,
            errorStatus: error?.response?.status
          });
          // #endregion
          // No active trip for this student
        }
      }
      // #region agent log
      console.log('[DEBUG] checkActiveTrips: Completed', { tripsFound: trips.size, tripStudentIds: Array.from(trips.keys()) });
      // #endregion
      setActiveTrips(trips);
    };

    if (students.length > 0) {
      checkActiveTrips();
      const interval = setInterval(checkActiveTrips, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [students]);

  const fetchStudents = async () => {
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
                      <Ionicons name="car" size={20} color="#10b981" />
                      <Text style={styles.tripStatus}>Active Trip</Text>
                    </View>
                    <Text style={styles.tripName}>{activeTrip.name}</Text>
                    <TouchableOpacity
                      style={styles.trackButton}
                      onPress={() => handleTrackTrip(student, activeTrip)}
                    >
                      <Text style={styles.trackButtonText}>Track Trip</Text>
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
  tripName: {
    fontSize: 14,
    color: "#166534",
    marginBottom: 10,
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

