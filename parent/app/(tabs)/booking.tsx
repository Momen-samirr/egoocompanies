import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useParentDashboard } from "@/features/dashboard/hooks/useParentDashboard";

export default function BookingTabScreen() {
  const { students, tripsByStudent } = useParentDashboard();

  const scheduledTrips = useMemo(
    () =>
      students
        .map((student) => ({ student, trip: tripsByStudent.get(student.id) }))
        .filter((entry) => entry.trip && entry.trip.status !== "ACTIVE"),
    [students, tripsByStudent]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Bookings</Text>
      <Text style={styles.subtitle}>Upcoming and scheduled student trips.</Text>

      {scheduledTrips.length ? (
        scheduledTrips.map(({ student, trip }) => (
          <View key={student.id} style={styles.card}>
            <View style={styles.cardLeft}>
              <Ionicons name="calendar-clear-outline" size={20} color="#4648D4" />
              <View>
                <Text style={styles.studentName}>
                  {student.firstName} {student.lastName}
                </Text>
                <Text style={styles.tripName}>{trip?.name || "Scheduled trip"}</Text>
              </View>
            </View>
            <Text style={styles.badge}>Scheduled</Text>
          </View>
        ))
      ) : (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={30} color="#98A2B3" />
          <Text style={styles.emptyText}>No scheduled trips available.</Text>
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
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7C3AED",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  empty: {
    marginTop: 32,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  emptyText: { marginTop: 8, color: "#667085", fontSize: 14, fontWeight: "500" },
});
