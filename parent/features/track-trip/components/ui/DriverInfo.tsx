/**
 * Driver information card component
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AssignedCaptain } from "../../types";

/**
 * Props for DriverInfo component
 */
export interface DriverInfoProps {
  driver: AssignedCaptain;
  onCall?: (phoneNumber: string) => void;
}

/**
 * Driver information card with avatar, name, vehicle details, and call button
 */
export function DriverInfo({ driver, onCall }: DriverInfoProps) {
  const [imageLoadError, setImageLoadError] = useState(false);

  const handleCall = () => {
    if (driver.phone_number) {
      if (onCall) {
        onCall(driver.phone_number);
      } else {
        Linking.openURL(`tel:${driver.phone_number}`);
      }
    }
  };

  return (
    <View style={styles.driverCard}>
      <View style={styles.driverHeader}>
        <View style={styles.driverAvatar}>
          {driver.selfiePhoto && !imageLoadError ? (
            <Image
              source={{ uri: driver.selfiePhoto }}
              style={styles.avatarImage}
              onError={() => setImageLoadError(true)}
              resizeMode="cover"
            />
          ) : driver.selfiePhoto && imageLoadError ? (
            <Text style={styles.avatarText}>{driver.name.charAt(0)}</Text>
          ) : (
            <Ionicons name="person" size={24} color="#6366f1" />
          )}
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{driver.name}</Text>
          <Text style={styles.driverDetails}>
            {driver.vehicle_type} • {driver.registration_number}
          </Text>
        </View>
        {driver.phone_number && (
          <TouchableOpacity style={styles.callButton} onPress={handleCall}>
            <Ionicons name="call" size={24} color="#6366f1" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  driverCard: {
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#6366f1",
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  driverDetails: {
    fontSize: 14,
    color: "#6b7280",
  },
  callButton: {
    padding: 10,
  },
});

