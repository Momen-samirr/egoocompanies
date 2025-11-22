import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from "react-native";
import React from "react";
import { useTheme } from "@react-navigation/native";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { spacing } from "@/styles/design-system";
import { Call, Message, Star } from "@/utils/icons";
import Images from "@/utils/images";

interface PassengerCardProps {
  passenger: {
    id?: string;
    name?: string;
    phone_number?: string;
    rating?: number;
    photo?: string;
  };
  onCallPress?: () => void;
  onMessagePress?: () => void;
}

export default function PassengerCard({
  passenger,
  onCallPress,
  onMessagePress,
}: PassengerCardProps) {
  const { colors } = useTheme();

  const handleCall = () => {
    if (onCallPress) {
      onCallPress();
    } else if (passenger.phone_number) {
      Linking.openURL(`tel:${passenger.phone_number}`);
    }
  };

  const handleMessage = () => {
    if (onMessagePress) {
      onMessagePress();
    } else if (passenger.phone_number) {
      Linking.openURL(`sms:${passenger.phone_number}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.profileSection}>
        <Image
          source={passenger.photo ? { uri: passenger.photo } : Images.user}
          style={styles.avatar}
        />
        <View style={styles.infoSection}>
          <Text style={[styles.name, { color: colors.text }]}>
            {passenger.name || "Passenger"}
          </Text>
          {passenger.rating !== undefined && (
            <View style={styles.ratingContainer}>
              <Star fill={color.completeColor} width={14} height={14} />
              <Text style={[styles.rating, { color: colors.text }]}>
                {passenger.rating.toFixed(1)}
              </Text>
            </View>
          )}
          {passenger.phone_number && (
            <Text style={[styles.phone, { color: color.text.secondary }]}>
              {passenger.phone_number}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actionsSection}>
        {passenger.phone_number && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: color.status.completed }]}
              onPress={handleCall}
              activeOpacity={0.7}
              accessibilityLabel="Call passenger"
              accessibilityRole="button"
            >
              <Call color={color.whiteColor} width={20} height={20} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: color.status.active }]}
              onPress={handleMessage}
              activeOpacity={0.7}
              accessibilityLabel="Message passenger"
              accessibilityRole="button"
            >
              <Message color={color.whiteColor} width={20} height={20} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: spacing.md,
    backgroundColor: color.lightGray,
  },
  infoSection: {
    flex: 1,
  },
  name: {
    fontSize: fontSizes.FONT18,
    fontFamily: fonts.bold,
    fontWeight: "600",
    marginBottom: spacing.xs / 2,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs / 2,
    gap: spacing.xs / 2,
  },
  rating: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
  },
  phone: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.regular,
  },
  actionsSection: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});

