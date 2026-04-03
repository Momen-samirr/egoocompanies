import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useParentDashboard } from "@/features/dashboard/hooks/useParentDashboard";

export default function TrackingTabScreen() {
  const router = useRouter();
  const { students, tripsByStudent } = useParentDashboard();

  const activeTrips = useMemo(
    () =>
      students
        .map((student) => ({ student, trip: tripsByStudent.get(student.id) }))
        .filter((entry) => entry.trip?.status === "ACTIVE"),
    [students, tripsByStudent]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Live Tracking</Text>
      <Text style={styles.subtitle}>Track active trips for your students.</Text>

      {activeTrips.length ? (
        activeTrips.map(({ student, trip }) => (
          <TouchableOpacity
            key={student.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/(routes)/track-trip",
                params: { studentId: student.id, tripId: trip!.id },
              })
            }
          >
            <View style={styles.cardLeft}>
              <Ionicons name="navigate-circle" size={22} color="#4648D4" />
              <View>
                <Text style={styles.studentName}>
                  {student.firstName} {student.lastName}
                </Text>
                <Text style={styles.tripName}>{trip?.name || "Active trip"}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.empty}>
          <Ionicons name="git-network-outline" size={30} color="#98A2B3" />
          <Text style={styles.emptyText}>No active trips right now.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { padding: 20, paddingBottom: 120 },
  title: { fontSize: 30, fontWeight: "800", color: "#191C1D", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#60636E", marginBottom: 14 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  studentName: { fontSize: 16, fontWeight: "700", color: "#191C1D" },
  tripName: { fontSize: 13, color: "#60636E", marginTop: 2 },
  empty: {
    marginTop: 32,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  emptyText: { marginTop: 8, color: "#667085", fontSize: 14, fontWeight: "500" },
});
