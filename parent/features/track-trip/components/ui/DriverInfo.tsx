/**
 * Driver information card component
 */

import React from "react";
import { View, StyleSheet, Linking } from "react-native";
import { AssignedCaptain } from "../../types";
import KineticDriverCard from "@/components/kinetic/KineticDriverCard";

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
      <KineticDriverCard
        name={driver.name}
        vehicleText={`${driver.vehicle_type} • ${driver.registration_number}`}
        avatarUrl={driver.selfiePhoto}
        onCall={driver.phone_number ? handleCall : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  driverCard: {
    paddingHorizontal: 14,
    marginBottom: 10,
  },
});

