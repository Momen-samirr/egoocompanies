import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { windowHeight, fontSizes } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { spacing } from "@/styles/design-system";
import { Gps, Location } from "@/utils/icons";
import HomeMap from "./HomeMap";
import PassengerCard from "@/components/ride/PassengerCard";
import ETADisplay from "@/components/common/ETADisplay";
import Button from "@/components/common/button";

export interface RideRequestData {
  user: any;
  pickupLocation: { latitude: number; longitude: number };
  destinationLocation: { latitude: number; longitude: number };
  pickupLocationName: string;
  destinationLocationName: string;
  distance: string;
  estimatedFare: string;
  estimatedDistance: number;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

interface RideRequestModalProps {
  visible: boolean;
  data: RideRequestData | null;
  loading?: boolean;
  mapError?: string | null;
  mapLoading?: boolean;
  mapReady?: boolean;
  onClose: () => void;
  onAccept: () => void;
  onRegionChange?: (region: any) => void;
  onMapReady?: () => void;
  onMapError?: (error: any) => void;
}

/**
 * RideRequestModal Component
 * Displays ride request details in a modal
 */
export default React.memo(function RideRequestModal({
  visible,
  data,
  loading = false,
  mapError,
  mapLoading = true,
  mapReady = false,
  onClose,
  onAccept,
  onRegionChange,
  onMapReady,
  onMapError,
}: RideRequestModalProps) {
  const { colors } = useTheme();

  const handleRegionChange = useCallback(
    (region: any) => {
      if (onRegionChange) {
        onRegionChange(region);
      }
    },
    [onRegionChange]
  );

  const handleMapReady = useCallback(() => {
    if (onMapReady) {
      onMapReady();
    }
  }, [onMapReady]);

  const handleMapError = useCallback(
    (error: any) => {
      if (onMapError) {
        onMapError(error);
      }
    },
    [onMapError]
  );

  if (!data) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackground}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.background,
              maxHeight: "90%",
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              New Ride Request
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 24, color: colors.text }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Map View */}
            <View style={{ marginBottom: spacing.lg }}>
              <HomeMap
                region={data.region}
                pickupLocation={data.pickupLocation}
                destinationLocation={data.destinationLocation}
                onRegionChange={handleRegionChange}
                onMapReady={handleMapReady}
                onError={handleMapError}
                mapError={mapError}
                mapLoading={mapLoading}
              />
            </View>

            {/* Passenger Info */}
            {data.user && (
              <View style={{ marginBottom: spacing.lg }}>
                <PassengerCard passenger={data.user} />
              </View>
            )}

            {/* Location Details */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: spacing.lg,
                marginBottom: spacing.lg,
              }}
            >
              <View style={{ flexDirection: "row", marginBottom: spacing.md }}>
                <View style={styles.leftView}>
                  <Location color={color.status.completed} />
                  <View
                    style={[
                      styles.verticaldot,
                      { borderColor: color.primary },
                    ]}
                  />
                  <Gps colors={color.status.active} />
                </View>
                <View style={[styles.rightView, { flex: 1 }]}>
                  <Text
                    style={[
                      styles.pickup,
                      { color: colors.text, marginBottom: spacing.sm },
                    ]}
                    numberOfLines={2}
                  >
                    {data.pickupLocationName || "Pickup Location"}
                  </Text>
                  <View style={styles.border} />
                  <Text
                    style={[styles.drop, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {data.destinationLocationName || "Destination"}
                  </Text>
                </View>
              </View>

              {/* ETA and Distance */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <ETADisplay distance={data.estimatedDistance} size="md" />
                <View>
                  <Text
                    style={{
                      fontSize: fontSizes.FONT12,
                      fontFamily: fonts.regular,
                      color: color.text.secondary,
                      marginBottom: spacing.xs / 2,
                    }}
                  >
                    Estimated Fare
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSizes.FONT20,
                      fontFamily: fonts.bold,
                      color: color.primary,
                    }}
                  >
                    {data.estimatedFare} BDT
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                marginBottom: spacing.lg,
              }}
            >
              <Button
                title="Decline"
                onPress={onClose}
                width="48%"
                height={windowHeight(50)}
                backgroundColor={color.semantic.error}
              />
              <Button
                title={loading ? "Accepting..." : "Accept Ride"}
                onPress={onAccept}
                width="48%"
                height={windowHeight(50)}
                disabled={loading}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSizes.FONT20,
    fontFamily: fonts.bold,
    fontWeight: "600",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  leftView: {
    alignItems: "center",
    marginRight: spacing.md,
  },
  verticaldot: {
    width: 2,
    flex: 1,
    borderWidth: 1,
    marginVertical: spacing.xs,
  },
  rightView: {
    flex: 1,
  },
  pickup: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.medium,
  },
  drop: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.medium,
  },
  border: {
    height: 1,
    backgroundColor: color.border,
    marginVertical: spacing.sm,
  },
});

