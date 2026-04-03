import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import Header from "@/components/common/header";
import { useTheme } from "@react-navigation/native";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";
import { spacing, shadows } from "@/styles/design-system";
import { useScheduledTripsDashboard } from "@/hooks/useScheduledTripsDashboard";
import { useGetDriverData } from "@/hooks/useGetDriverData";
import {
  ScheduledTripItem,
  getActivationMessage,
  getTripActionState,
  normalizeTripStatus,
} from "@/services/scheduledTripsService";

const statusTone = (
  status: ScheduledTripItem["status"],
  t: (key: string) => string
) => {
  if (status === "ACTIVE")
    return { bg: "#E8F4FF", text: "#2563EB", label: t("pill_ACTIVE") };
  if (status === "COMPLETED")
    return { bg: "#E8F8EE", text: "#059669", label: t("pill_COMPLETED") };
  if (status === "FAILED")
    return { bg: "#FDECEC", text: "#DC2626", label: t("pill_FAILED") };
  if (status === "FORCE_CLOSED")
    return { bg: "#FFEAF2", text: "#E11D48", label: t("pill_FORCE_CLOSED") };
  if (status === "CANCELLED")
    return { bg: "#FFEFEA", text: "#F97316", label: t("pill_CANCELLED") };
  return { bg: "#F2F4F7", text: "#374151", label: t("pill_SCHEDULED") };
};

const formatTripTime = (scheduledTime: string) => {
  const date = new Date(scheduledTime);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const dayPillLabel = (
  date: Date,
  selectedDate: Date,
  todayLabel: string
) => {
  const sameDay =
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear();
  if (!sameDay) {
    return date
      .toLocaleDateString([], { weekday: "short" })
      .toUpperCase()
      .slice(0, 3);
  }
  return todayLabel;
};

const ScheduledTripCard = ({
  trip,
  isOnline,
  onActivate,
  onContinue,
  startingTripId,
  activeTripId,
}: {
  trip: ScheduledTripItem;
  isOnline: boolean;
  onActivate: (trip: ScheduledTripItem) => void;
  onContinue: (tripId: string) => void;
  startingTripId: string | null;
  activeTripId: string | null;
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation("trips");
  const tone = statusTone(trip.status, t);
  const normalizedStatus = normalizeTripStatus(trip.status);
  const isActiveTrip = activeTripId === trip.id || normalizedStatus === "ACTIVE";
  const canActivate =
    isOnline &&
    (normalizedStatus === "SCHEDULED" ||
      normalizedStatus === "PENDING" ||
      normalizedStatus === "NOT_STARTED") &&
    !!trip.activationStatus?.canActivate &&
    (!activeTripId || activeTripId === trip.id);
  const actionState = getTripActionState({
    status: isActiveTrip ? "ACTIVE" : trip.status,
    canActivate,
    isOnline,
    isActivating: startingTripId === trip.id,
  });

  const participantCount = useMemo(() => {
    return trip.points.reduce(
      (sum, point) => sum + (point.employees?.length || 0),
      0
    );
  }, [trip.points]);

  return (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusPillText, { color: tone.text }]}>
            • {tone.label}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.tripTime}>{formatTripTime(trip.scheduledTime)}</Text>
          <Text style={styles.tripMetaSmall}>
            {t("checkpointsMeta", { count: trip.points.length })}
          </Text>
        </View>
      </View>

      <Text style={[styles.tripTitle, { color: colors.text }]} numberOfLines={1}>
        {trip.name}
      </Text>
      <Text style={styles.tripSubtitle} numberOfLines={1}>
        📍 {trip.points?.[0]?.name || t("routeUnavailable")}
      </Text>

      <View style={styles.participantsRow}>
        <View style={styles.avatarStack}>
          <View style={[styles.avatarCircle, { marginStart: 0 }]}>
            <Text style={styles.avatarText}>D</Text>
          </View>
          <View
            style={[
              styles.avatarCircle,
              { marginStart: -10, backgroundColor: "#E4E6FF" },
            ]}
          >
            <Text style={styles.avatarText}>C</Text>
          </View>
          <View style={styles.participantCountChip}>
            <Text style={styles.participantCountText}>
              +{participantCount || trip.points.length}
            </Text>
          </View>
        </View>
        <View style={styles.tripDivider} />
      </View>

      <TouchableOpacity
        onPress={() => {
          if (actionState.actionType === "activate") {
            onActivate(trip);
          } else if (actionState.actionType === "continue") {
            onContinue(trip.id);
          }
        }}
        disabled={actionState.disabled}
        activeOpacity={0.8}
        style={[
          styles.activateButton,
          {
            backgroundColor: actionState.backgroundColor,
          },
        ]}
      >
        {startingTripId === trip.id ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text
            style={[
              styles.activateButtonText,
              { color: actionState.textColor },
            ]}
          >
            {actionState.isActivating
              ? t("activating")
              : actionState.actionType === "continue"
                ? t("continueTrip")
                : actionState.actionType === "failed"
                  ? t("tripFailed")
                  : actionState.actionType === "activate"
                    ? t("activateTrip")
                    : t("unavailable")}
          </Text>
        )}
      </TouchableOpacity>

      {!canActivate &&
        (normalizedStatus === "SCHEDULED" ||
          normalizedStatus === "PENDING" ||
          normalizedStatus === "NOT_STARTED") && (
        <Text style={styles.activationHint}>
          {getActivationMessage(trip, isOnline, t)}
        </Text>
      )}
    </View>
  );
};

export default function ScheduledTripsScreen() {
  const { driver } = useGetDriverData();
  const { colors } = useTheme();
  const { t } = useTranslation("trips");
  const { t: th } = useTranslation("home");
  const {
    selectedDate,
    setSelectedDate,
    weekDates,
    dayTrips,
    loading,
    refreshing,
    isOnline,
    startingTripId,
    activeTripId,
    metrics,
    handleRefresh,
    activateTrip,
    continueTrip,
  } = useScheduledTripsDashboard(driver?.status);

  const renderDatePill = ({ item }: { item: Date }) => {
    const isSelected =
      item.getDate() === selectedDate.getDate() &&
      item.getMonth() === selectedDate.getMonth() &&
      item.getFullYear() === selectedDate.getFullYear();

    return (
      <TouchableOpacity
        onPress={() => setSelectedDate(item)}
        activeOpacity={0.8}
        style={[styles.datePill, isSelected && styles.datePillSelected]}
      >
        <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>
          {dayPillLabel(item, selectedDate, th("today"))}
        </Text>
        <Text style={[styles.dateNumber, isSelected && styles.dateTextSelected]}>
          {item.getDate()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t("scheduledTitle")} showMenuButton showNotificationIcon={false} />

      <FlatList
        data={dayTrips}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={
          <View>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleRefresh}
              activeOpacity={0.8}
            >
              <Text style={styles.syncIcon}>↻</Text>
            </TouchableOpacity>

            <FlatList
              horizontal
              data={weekDates}
              keyExtractor={(item) => item.toISOString()}
              renderItem={renderDatePill}
              contentContainerStyle={styles.dateList}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        }
        renderItem={({ item }) => (
          <ScheduledTripCard
            trip={item}
            isOnline={isOnline}
            onActivate={activateTrip}
            onContinue={continueTrip}
            startingTripId={startingTripId}
            activeTripId={activeTripId}
          />
        )}
        ListFooterComponent={
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: "#F4F6FF" }]}>
              <Text style={styles.statIcon}>🧭</Text>
              <Text style={[styles.statValue, { color: color.primary }]}>
                {metrics.totalMilesWeek.toFixed(0)}
              </Text>
              <Text style={styles.statLabel}>{t("totalMilesWeekLabel")}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#FFFFFF" }]}>
              <Text style={styles.statTitle}>{t("efficiencyScoreLabel")}</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {Math.round(metrics.efficiencyScore)}%
              </Text>
              <Text style={styles.statTrend}>↗</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{t("emptyScheduledTitle")}</Text>
              <Text style={styles.emptyMessage}>
                {t("emptyScheduledMessage")}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={color.primary} />
          <Text style={styles.loadingText}>{t("loadingScheduledTrips")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  syncButton: {
    alignSelf: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  syncIcon: {
    fontSize: 20,
    color: "#9CA3AF",
  },
  dateList: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  datePill: {
    width: 58,
    height: 92,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  datePillSelected: {
    backgroundColor: color.primary,
  },
  dateDay: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT11,
    color: "#9CA3AF",
    letterSpacing: 1,
  },
  dateNumber: {
    marginTop: spacing.xs,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT30,
    color: "#1F2937",
  },
  dateTextSelected: {
    color: "#FFFFFF",
  },
  tripCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: spacing.lg,
    ...shadows.md,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT11,
    letterSpacing: 1,
  },
  tripTime: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT30,
    color: color.primary,
  },
  tripMetaSmall: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT12,
    color: "#4B5563",
  },
  tripTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT34,
    marginBottom: spacing.xs,
  },
  tripSubtitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT18,
    color: "#4B5563",
    marginBottom: spacing.md,
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 84,
  },
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT11,
  },
  participantCountChip: {
    marginStart: -8,
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  participantCountText: {
    color: color.primary,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT11,
  },
  tripDivider: {
    flex: 1,
    height: 2,
    backgroundColor: "#EEF0F4",
    marginStart: spacing.md,
    borderRadius: 999,
  },
  activateButton: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  activateButtonText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT20,
  },
  activationHint: {
    marginTop: spacing.xs,
    color: "#9CA3AF",
    fontFamily: fonts.regular,
    fontSize: fontSizes.FONT12,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: 22,
    padding: spacing.lg,
    minHeight: 130,
    ...shadows.sm,
  },
  statIcon: {
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  statTitle: {
    color: "#111827",
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT16,
    marginBottom: spacing.sm,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT42,
  },
  statLabel: {
    marginTop: spacing.xs,
    color: "#8B91A1",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT11,
    letterSpacing: 1,
  },
  statTrend: {
    alignSelf: "flex-end",
    color: "#16A34A",
    fontSize: 18,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#111827",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT24,
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    color: "#6B7280",
    fontFamily: fonts.regular,
    fontSize: fontSizes.FONT14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.sm,
    color: "#374151",
    fontFamily: fonts.medium,
  },
});
