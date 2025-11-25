import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import React, { useEffect, useState } from "react";
import { useTheme } from "@react-navigation/native";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { spacing, shadows } from "@/styles/design-system";
import { SmartCar, Driving, Calender } from "@/utils/icons";
import { Info } from "@/assets/icons/info";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getServerUri } from "@/configs/constants";
import { SkeletonCard } from "@/components/common/LoadingSkeleton";

interface DriverStats {
  completedTripsToday: number;
  failedTrips: number;
  upcomingScheduledTrips: number;
  activeTrip: {
    type: "scheduled" | "regular";
    id: string;
    name: string;
  } | null;
  totalCompletedTrips: number;
}

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
  backgroundColor: string;
  onPress?: () => void;
}

const StatCard = React.memo(function StatCard({ icon, value, label, color: textColor, backgroundColor, onPress }: StatCardProps) {
  const { colors } = useTheme();
  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      onPress={onPress}
      style={[
        styles.statCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        onPress && { ...shadows.sm },
      ]}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.iconContainer, { backgroundColor }]}>
        {icon}
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.text }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </CardWrapper>
  );
}, (prevProps, nextProps) => {
  // Only re-render if props change
  return (
    prevProps.value === nextProps.value &&
    prevProps.label === nextProps.label &&
    prevProps.color === nextProps.color &&
    prevProps.backgroundColor === nextProps.backgroundColor
  );
});

interface OverviewSectionProps {
  refreshTrigger?: number;
}

function OverviewSection({ refreshTrigger }: OverviewSectionProps = {}) {
  const { colors } = useTheme();
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create AbortController for request cancellation
    const abortController = new AbortController();

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const accessToken = await AsyncStorage.getItem("accessToken");
        
        if (!accessToken) {
          setError("Please login first");
          return;
        }

        const response = await axios.get(`${getServerUri()}/driver/stats`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: abortController.signal, // Add signal for cancellation
        });

        if (response.data.success) {
          setStats(response.data.stats);
        } else {
          setError("Failed to load statistics");
        }
      } catch (err: any) {
        // Don't set error if request was cancelled
        if (axios.isCancel(err) || err.name === "AbortError") {
          console.log("Request cancelled");
          return;
        }
        console.error("Error fetching driver stats:", err);
        setError(err.response?.data?.message || "Failed to load statistics");
      } finally {
        // Only update loading state if component is still mounted
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchStats();

    // Cleanup: cancel request if component unmounts
    return () => {
      abortController.abort();
    };
  }, [refreshTrigger]);


  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Overview</Text>
        <View style={styles.cardsContainer}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.statCard}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Overview</Text>
        <View
          style={[
            styles.errorContainer,
            {
              backgroundColor: color.semantic.errorLight,
              borderColor: color.semantic.error,
            },
          ]}
        >
          <Text style={[styles.errorText, { color: color.semantic.error }]}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={fetchStats}
            style={[styles.retryButton, { backgroundColor: color.semantic.error }]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Overview</Text>
      
      <View style={styles.cardsContainer}>
        {/* Completed Trips Today */}
        <StatCard
          icon={<SmartCar width={24} height={24} />}
          value={stats.completedTripsToday}
          label="Completed Today"
          color={color.status.completed}
          backgroundColor={`${color.status.completed}20`}
        />

        {/* Upcoming Scheduled Trips */}
        <StatCard
          icon={<Calender colors={color.status.scheduled} width={24} height={24} />}
          value={stats.upcomingScheduledTrips}
          label="Upcoming Trips"
          color={color.status.scheduled}
          backgroundColor={`${color.status.scheduled}20`}
          onPress={() => router.push("/(routes)/scheduled-trips")}
        />

        {/* Failed Trips */}
        {stats.failedTrips > 0 && (
          <StatCard
            icon={
              <View style={{ width: 24, height: 24, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 20 }}>⚠️</Text>
              </View>
            }
            value={stats.failedTrips}
            label="Failed Trips"
            color={color.semantic.error}
            backgroundColor={`${color.semantic.error}20`}
          />
        )}

        {/* Active Trip */}
        {stats.activeTrip && (
          <TouchableOpacity
            style={[
              styles.activeTripCard,
              {
                backgroundColor: color.status.active + "15",
                borderColor: color.status.active,
              },
            ]}
            onPress={() => {
              if (stats.activeTrip?.type === "scheduled") {
                router.push({
                  pathname: "/trip-navigation",
                  params: { tripId: stats.activeTrip.id },
                });
              } else {
                // Navigate to ride details if it's a regular ride
                router.push("/(tabs)/home");
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.activeTripHeader}>
              <View
                style={[
                  styles.activeTripIcon,
                  { backgroundColor: color.status.active },
                ]}
              >
                <Driving color="#fff" width={20} height={20} />
              </View>
              <View style={styles.activeTripContent}>
                <Text style={[styles.activeTripLabel, { color: color.status.active }]}>
                  Active Trip
                </Text>
                <Text
                  style={[styles.activeTripName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {stats.activeTrip.name}
                </Text>
              </View>
              <Text style={styles.activeTripArrow}>→</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Total Completed Trips */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.summaryLabel, { color: color.text.secondary }]}>
          Total Completed Trips
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {stats.totalCompletedTrips}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSizes.FONT20,
    fontFamily: fonts.bold,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  cardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  statCard: {
    width: "48%",
    margin: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: fontSizes.FONT20,
    fontFamily: fonts.bold,
    fontWeight: "600",
    marginBottom: spacing.xs / 2,
  },
  statLabel: {
    fontSize: fontSizes.FONT12,
    fontFamily: fonts.regular,
    lineHeight: fontSizes.FONT16,
  },
  activeTripCard: {
    width: "100%",
    margin: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
  },
  activeTripHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  activeTripIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  activeTripContent: {
    flex: 1,
  },
  activeTripLabel: {
    fontSize: fontSizes.FONT12,
    fontFamily: fonts.medium,
    fontWeight: "600",
    marginBottom: spacing.xs / 2,
  },
  activeTripName: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.medium,
  },
  activeTripArrow: {
    fontSize: fontSizes.FONT20,
    color: color.text.secondary,
  },
  summaryCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.regular,
  },
  summaryValue: {
    fontSize: fontSizes.FONT18,
    fontFamily: fonts.bold,
    fontWeight: "600",
  },
  errorContainer: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  errorText: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
    fontWeight: "600",
  },
});

// Memoize component to prevent unnecessary re-renders
export default React.memo(OverviewSection, (prevProps, nextProps) => {
  // Only re-render if refreshTrigger changes
  return prevProps.refreshTrigger === nextProps.refreshTrigger;
});

