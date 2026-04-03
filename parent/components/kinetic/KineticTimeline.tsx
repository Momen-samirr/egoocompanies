import React from "react";
import { StyleSheet, Text, View } from "react-native";

type TimelineItem = {
  id: string;
  label: string;
  subtitle?: string;
  state: "done" | "current" | "upcoming";
};

type KineticTimelineProps = {
  items: TimelineItem[];
};

export default function KineticTimeline({ items }: KineticTimelineProps) {
  return (
    <View style={styles.wrap}>
      {items.map((item, idx) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.dotCol}>
            <View
              style={[
                styles.dot,
                item.state === "done"
                  ? styles.doneDot
                  : item.state === "current"
                  ? styles.currentDot
                  : styles.upcomingDot,
              ]}
            />
            {idx < items.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.textCol}>
            <Text
              style={[
                styles.label,
                item.state === "current" ? styles.currentLabel : styles.defaultLabel,
              ]}
            >
              {item.label}
            </Text>
            {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  dotCol: {
    width: 20,
    alignItems: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  doneDot: {
    backgroundColor: "#10b981",
  },
  currentDot: {
    backgroundColor: "#4648d4",
  },
  upcomingDot: {
    backgroundColor: "#c7c4d7",
  },
  line: {
    marginTop: 4,
    width: 2,
    flex: 1,
    backgroundColor: "rgba(199,196,215,0.5)",
  },
  textCol: {
    flex: 1,
    paddingBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  defaultLabel: {
    color: "#191c1d",
  },
  currentLabel: {
    color: "#4648d4",
  },
  subtitle: {
    marginTop: 2,
    color: "#60636E",
    fontSize: 12,
  },
});

