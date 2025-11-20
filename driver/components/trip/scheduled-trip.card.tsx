import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import React from "react";
import { useTheme } from "@react-navigation/native";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import fonts from "@/themes/app.fonts";
import color from "@/themes/app.colors";
import { Gps, Location } from "@/utils/icons";
import { router } from "expo-router";

interface ScheduledTrip {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED";
  points: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    isFinalPoint: boolean;
  }>;
  assignedCaptain?: {
    id: string;
    name: string;
  };
  progress?: {
    startedAt: string | null;
    completedAt: string | null;
  } | null;
}

export default function ScheduledTripCard({ item }: { item: ScheduledTrip }) {
  const { colors } = useTheme();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return "#fbbf24"; // yellow
      case "ACTIVE":
        return "#3b82f6"; // blue
      case "COMPLETED":
        return "#10b981"; // green
      case "CANCELLED":
        return "#ef4444"; // red
      case "FAILED":
        return "#dc2626"; // dark red for failed trips
      default:
        return "#6b7280"; // gray
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const dateTime = formatDateTime(item.scheduledTime);
  const statusColor = getStatusColor(item.status);

  const handlePress = () => {
    router.push({
      pathname: "/trip-details",
      params: { tripId: item.id },
    });
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.main,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.top, { backgroundColor: colors.background }]}>
        <View style={[styles.alignment, { flexDirection: "row" }]}>
          <View style={[styles.profile, { flexDirection: "row" }]}>
            <Text style={[styles.tripName, { color: colors.text }]}>
              {item.name}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor + "20" },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status === "FAILED" ? "Failed" : item.status}
            </Text>
          </View>
        </View>
        <View style={[styles.alignment, { flexDirection: "row" }]}>
          <Text style={styles.timing}>
            {dateTime.date} at {dateTime.time}
          </Text>
          <View style={styles.rate}>
            <Location color={colors.text} />
            <Text style={[styles.distance, { color: colors.text }]}>
              {item.points?.length || 0} checkpoint(s)
            </Text>
          </View>
        </View>
        {item.progress?.startedAt && (
          <Text style={[styles.progressText, { color: colors.text }]}>
            Started: {new Date(item.progress.startedAt).toLocaleString()}
          </Text>
        )}
        {item.progress?.completedAt && (
          <Text style={[styles.progressText, { color: colors.text }]}>
            Completed: {new Date(item.progress.completedAt).toLocaleString()}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.bottom,
          styles.alignment,
          { backgroundColor: colors.background },
        ]}
      >
        <View style={{ flexDirection: "row", height: "auto" }}>
          <View style={styles.leftView}>
            {item.points && item.points.length > 0 && (
              <>
                <Location color={colors.text} />
                {item.points.length > 1 && (
                  <>
                    <View
                      style={[
                        styles.verticaldot,
                        { borderColor: color.darkBorder },
                      ]}
                    />
                    {item.points.map((_, index) => {
                      if (index === item.points.length - 1) return null;
                      return (
                        <View key={index}>
                          <View
                            style={[
                              styles.verticaldot,
                              { borderColor: color.darkBorder },
                            ]}
                          />
                        </View>
                      );
                    })}
                  </>
                )}
                <Gps colors={colors.text} />
              </>
            )}
          </View>
          <View style={styles.rightView}>
            {item.points && item.points.length > 0 && (
              <>
                <Text style={[styles.pickup, { color: colors.text }]}>
                  {item.points[0].name}
                </Text>
                {item.points.length > 1 && (
                  <Text style={[styles.drop, { color: colors.text }]}>
                    {item.points[item.points.length - 1].name}
                    {item.points[item.points.length - 1].isFinalPoint && " (Final)"}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  main: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 5,
    padding: windowWidth(5),
    marginVertical: 5,
  },
  top: {
    flex: 1,
    marginBottom: windowHeight(1.5),
    paddingHorizontal: windowWidth(3),
    borderRadius: 5,
    paddingVertical: windowHeight(5),
  },
  alignment: {
    justifyContent: "space-between",
  },
  profile: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  tripName: {
    marginHorizontal: windowWidth(5),
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT20,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: windowWidth(3),
    paddingVertical: windowHeight(1),
    borderRadius: 12,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT12,
    fontWeight: "600",
  },
  rate: {
    flexDirection: "row",
    marginHorizontal: windowWidth(5),
    justifyContent: "center",
    alignItems: "center",
  },
  timing: {
    color: color.secondaryFont,
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT18,
  },
  distance: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT18,
    marginLeft: windowWidth(2),
  },
  progressText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT14,
    marginTop: windowHeight(1),
    color: color.secondaryFont,
  },
  bottom: {
    flex: 1,
    paddingHorizontal: windowWidth(5),
    borderRadius: 5,
    paddingVertical: windowHeight(5),
  },
  leftView: {
    marginRight: windowWidth(5),
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: windowHeight(3),
    marginTop: windowHeight(4),
  },
  rightView: {
    marginTop: windowHeight(5),
    flex: 1,
  },
  verticaldot: {
    borderLeftWidth: 1,
    height: windowHeight(20),
    marginHorizontal: 5,
  },
  pickup: {
    fontSize: fontSizes.FONT18,
  },
  drop: {
    fontSize: fontSizes.FONT18,
    paddingTop: windowHeight(20),
  },
});

