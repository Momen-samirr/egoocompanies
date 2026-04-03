import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "@/hooks/useNotifications";
import KineticPrimaryButton from "@/components/kinetic/KineticPrimaryButton";
import {
  DashboardActivityItem,
  DashboardTrip,
  ParentStudent,
} from "@/features/dashboard/services/dashboard.service";
import { useParentDashboard } from "@/features/dashboard/hooks/useParentDashboard";

const MAP_PREVIEW_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCpqicDhUDhf7E1swUFBbhtCIVHOd7Hs0o30OixW7sEArorK_Ag7-Zk47e970FYldmXVlAv4C_DjjekfOI45rgFryYA8NLfjbP526KPQzI8VWe8BXAoTHKuzC7Pcpq34Fz3_B9h06BWkWUm9wQTNkTpKE7vru25YlOhhzBeLKQdw3z3YrEJemdv-97gD_Ha-HjEzgSazJmAKqQy4drNqXkEWLlOJoHB19saDoTLDi7M8ymPJMJiWKe-X5TUEQ-nP8ba0-yUz6jctOaO";

const formatEta = (trip?: DashboardTrip | null): string => {
  if (!trip) return "--:--";
  const raw = trip.estimatedArrival || trip.eta || trip.etaToStudent || trip.scheduledTime;
  if (!raw) return "--:--";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

function StudentAvatar({ student }: { student: ParentStudent }) {
  const imageUri = student.selfiePhoto;
  if (imageUri) {
    return <Image source={{ uri: imageUri }} style={styles.avatar} />;
  }

  return (
    <View style={styles.avatarFallback}>
      <Ionicons name="person" size={20} color="#4648D4" />
    </View>
  );
}

function ActivityItem({ item }: { item: DashboardActivityItem }) {
  return (
    <View style={styles.activityItem}>
      <View style={styles.activityIconWrap}>
        <Ionicons
          name={item.icon === "school" ? "school-outline" : "bus-outline"}
          size={18}
          color="#4648D4"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activitySubtitle}>{item.subtitle}</Text>
        <Text style={styles.activityTime}>{item.timeLabel}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const {
    parentFirstName,
    parentAvatarUrl,
    students,
    tripsByStudent,
    recentActivities,
    loading,
    refreshing,
    loadingTrips,
    refresh,
  } = useParentDashboard();

  // Keep push registration behavior intact.
  useNotifications();

  const [primaryStudent, secondaryStudent] = useMemo(() => {
    if (!students.length) return [null, null] as const;

    const withActiveTrip = students.find((s) => {
      const trip = tripsByStudent.get(s.id);
      return trip?.status === "ACTIVE";
    });
    const first = withActiveTrip || students[0];
    const second = students.find((s) => s.id !== first.id) || null;
    return [first, second] as const;
  }, [students, tripsByStudent]);

  const primaryTrip = primaryStudent ? tripsByStudent.get(primaryStudent.id) : null;
  const secondaryTrip = secondaryStudent ? tripsByStudent.get(secondaryStudent.id) : null;

  const handleTrackTrip = (student: ParentStudent, trip: DashboardTrip) => {
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
        <ActivityIndicator size="large" color="#4648D4" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.menuButton} activeOpacity={0.8}>
            <Ionicons name="menu-outline" size={22} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>My Students</Text>
        </View>
        <View style={styles.parentAvatarWrap}>
          {parentAvatarUrl ? (
            <Image source={{ uri: parentAvatarUrl }} style={styles.parentAvatar} />
          ) : (
            <View style={styles.parentAvatarFallback}>
              <Ionicons name="person" size={16} color="#FFFFFF" />
            </View>
          )}
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.greeting}>Good Morning, {parentFirstName}</Text>
        <Text style={styles.headline}>Stay Connected.</Text>

        {primaryStudent && (
          <View style={styles.primaryCard}>
            <View style={styles.primaryHeader}>
              <View style={styles.studentInfoRow}>
                <StudentAvatar student={primaryStudent} />
                <View>
                  <Text style={styles.primaryStudentName}>
                    {primaryStudent.firstName} {primaryStudent.lastName}
                  </Text>
                  <Text style={styles.primaryStudentMeta}>
                    {primaryStudent.grade || primaryStudent.school.name}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.tripPill,
                  primaryTrip?.status === "ACTIVE"
                    ? styles.tripPillActive
                    : styles.tripPillScheduled,
                ]}
              >
                <View
                  style={[
                    styles.tripDot,
                    { backgroundColor: primaryTrip?.status === "ACTIVE" ? "#10B981" : "#CA8A04" },
                  ]}
                />
                <Text
                  style={[
                    styles.tripPillText,
                    { color: primaryTrip?.status === "ACTIVE" ? "#047857" : "#92400E" },
                  ]}
                >
                  {primaryTrip?.status === "ACTIVE" ? "ACTIVE TRIP" : "SCHEDULED"}
                </Text>
              </View>
            </View>

            <View style={styles.mapCard}>
              <Image source={{ uri: MAP_PREVIEW_IMAGE }} style={styles.mapImage} />
              <View style={styles.mapOverlay} />
              <View style={styles.etaCard}>
                <Text style={styles.etaLabel}>ESTIMATED ARRIVAL</Text>
                <Text style={styles.etaValue}>{formatEta(primaryTrip)}</Text>
              </View>
            </View>

            <KineticPrimaryButton
              title={primaryTrip?.status === "ACTIVE" ? "Track Live" : "View Route"}
              onPress={() => primaryTrip && handleTrackTrip(primaryStudent, primaryTrip)}
              disabled={!primaryTrip || loadingTrips}
              icon={<Ionicons name="navigate-outline" size={18} color="#FFFFFF" />}
            />
          </View>
        )}

        {secondaryStudent && (
          <View style={styles.secondaryCard}>
            <View style={styles.secondaryLeft}>
              <StudentAvatar student={secondaryStudent} />
              <View>
                <Text style={styles.secondaryName}>
                  {secondaryStudent.firstName} {secondaryStudent.lastName}
                </Text>
                <Text style={styles.secondaryMeta}>
                  {secondaryTrip?.scheduledTime
                    ? `Scheduled: ${formatEta(secondaryTrip)}`
                    : `Scheduled: ${secondaryStudent.stop?.name || "N/A"}`}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.routeButton}
              activeOpacity={0.85}
              disabled={!secondaryTrip}
              onPress={() => secondaryTrip && handleTrackTrip(secondaryStudent, secondaryTrip)}
            >
              <Text style={styles.routeButtonText}>View{"\n"}Route</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.activityHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity activeOpacity={0.8}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {recentActivities.length ? (
          <View style={styles.activityList}>
            {recentActivities.slice(0, 2).map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyActivity}>
            <Text style={styles.emptyActivityText}>No recent activity yet</Text>
          </View>
        )}

        {!students.length && (
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={44} color="#D1D5DB" />
            <Text style={styles.emptyText}>No students linked</Text>
            <Text style={styles.emptySubtext}>
              Contact your school to link your account to students.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(225,227,228,0.8)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  topTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#191C1D",
  },
  parentAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(70,72,212,0.2)",
  },
  parentAvatar: {
    width: "100%",
    height: "100%",
  },
  parentAvatarFallback: {
    flex: 1,
    backgroundColor: "#4648D4",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 14,
    fontWeight: "500",
    color: "#464554",
    marginBottom: 3,
  },
  headline: {
    fontSize: 48,
    fontWeight: "800",
    color: "#191C1D",
    marginBottom: 16,
    letterSpacing: -0.6,
  },
  primaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#4648D4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  primaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  studentInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E1E0FF",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryStudentName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#191C1D",
    lineHeight: 24,
  },
  primaryStudentMeta: {
    marginTop: 2,
    fontSize: 14,
    color: "#60636E",
  },
  tripPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tripPillActive: {
    backgroundColor: "#E8F8EE",
  },
  tripPillScheduled: {
    backgroundColor: "#FEF3C7",
  },
  tripDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  tripPillText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  mapCard: {
    height: 164,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#D8E4FF",
  },
  mapImage: {
    width: "100%",
    height: "100%",
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  etaCard: {
    position: "absolute",
    left: 12,
    bottom: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  etaLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#60636E",
    marginBottom: 2,
    letterSpacing: 0.6,
  },
  etaValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#4648D4",
  },
  secondaryCard: {
    borderRadius: 22,
    backgroundColor: "#F3F4F5",
    padding: 14,
    marginBottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  secondaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  secondaryName: {
    fontSize: 19,
    fontWeight: "700",
    color: "#191C1D",
  },
  secondaryMeta: {
    fontSize: 13,
    color: "#60636E",
    marginTop: 2,
  },
  routeButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 84,
    alignItems: "center",
  },
  routeButtonText: {
    color: "#4648D4",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 16,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#191C1D",
  },
  seeAll: {
    color: "#4648D4",
    fontSize: 14,
    fontWeight: "700",
  },
  activityList: {
    gap: 10,
  },
  activityItem: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  activityIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#191C1D",
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 13,
    color: "#60636E",
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.7,
  },
  emptyActivity: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 16,
    alignItems: "center",
  },
  emptyActivityText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "500",
  },
  emptyContainer: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 22,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: "700",
    color: "#111827",
  },
  emptySubtext: {
    marginTop: 8,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
});

