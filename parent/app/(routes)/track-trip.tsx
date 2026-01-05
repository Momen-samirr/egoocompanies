import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";
import { useTripTracking } from "@/hooks/useTripTracking";

export default function TrackTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { tripId, studentId } = params;

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mapRegion, setMapRegion] = useState<any>(null);

  const { location, connected, error } = useTripTracking({
    tripId: tripId as string,
    studentId: studentId as string,
    enabled: !!tripId && !!studentId,
  });

  useEffect(() => {
    fetchTripDetails();
  }, []);

  useEffect(() => {
    if (location && trip) {
      // Update map region to show driver and pickup point
      const driverLat = location.location.latitude;
      const driverLng = location.location.longitude;
      const studentPoint = trip.studentPoint || trip.points?.[0];

      if (studentPoint) {
        const minLat = Math.min(driverLat, studentPoint.latitude);
        const maxLat = Math.max(driverLat, studentPoint.latitude);
        const minLng = Math.min(driverLng, studentPoint.longitude);
        const maxLng = Math.max(driverLng, studentPoint.longitude);

        const latDelta = (maxLat - minLat) * 1.5 + 0.01;
        const lngDelta = (maxLng - minLng) * 1.5 + 0.01;

        setMapRegion({
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        });
      }
    }
  }, [location, trip]);

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/parent/students/${studentId}/trip`);
      if (response.data.success && response.data.trip) {
        setTrip(response.data.trip);

        // Set initial map region
        const studentPoint = response.data.trip.studentPoint || response.data.trip.points?.[0];
        if (studentPoint) {
          setMapRegion({
            latitude: studentPoint.latitude,
            longitude: studentPoint.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching trip:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCallDriver = () => {
    if (trip?.assignedCaptain?.phone_number) {
      Linking.openURL(`tel:${trip.assignedCaptain.phone_number}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Trip not found</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const studentPoint = trip.studentPoint || trip.points?.[0];
  const driverLocation = location?.location;

  return (
    <View style={styles.container}>
      {/* Map */}
      {mapRegion && (
        <MapView
          style={styles.map}
          region={mapRegion}
          showsUserLocation={true}
        >
          {/* Student Pickup Point */}
          {studentPoint && (
            <Marker
              coordinate={{
                latitude: studentPoint.latitude,
                longitude: studentPoint.longitude,
              }}
              title="Pickup Point"
              description={studentPoint.name}
            >
              <View style={styles.pickupMarker}>
                <Ionicons name="location" size={30} color="#6366f1" />
              </View>
            </Marker>
          )}

          {/* Driver Location */}
          {driverLocation && (
            <Marker
              coordinate={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
              }}
              title="Driver"
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.driverMarker}>
                <Ionicons name="car" size={24} color="#fff" />
              </View>
            </Marker>
          )}

          {/* Route Polyline */}
          {driverLocation && studentPoint && (
            <Polyline
              coordinates={[
                {
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                },
                {
                  latitude: studentPoint.latitude,
                  longitude: studentPoint.longitude,
                },
              ]}
              strokeColor="#6366f1"
              strokeWidth={3}
            />
          )}
        </MapView>
      )}

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <ScrollView>
          {/* Connection Status */}
          <View style={styles.statusBar}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: connected ? "#10b981" : "#ef4444" },
              ]}
            />
            <Text style={styles.statusText}>
              {connected ? "Live Tracking" : "Connecting..."}
            </Text>
          </View>

          {/* ETA Card */}
          {location?.eta && (
            <View style={styles.etaCard}>
              <Text style={styles.etaLabel}>Estimated Arrival</Text>
              <Text style={styles.etaValue}>
                {Math.round(location.eta.minutes)} min
              </Text>
              <Text style={styles.etaDistance}>
                {Math.round(location.eta.distanceMeters / 1000 * 10) / 10} km away
              </Text>
            </View>
          )}

          {/* Driver Info Card */}
          {trip.assignedCaptain && (
            <View style={styles.driverCard}>
              <View style={styles.driverHeader}>
                <View style={styles.driverAvatar}>
                  {trip.assignedCaptain.selfiePhoto ? (
                    <Text style={styles.avatarText}>
                      {trip.assignedCaptain.name.charAt(0)}
                    </Text>
                  ) : (
                    <Ionicons name="person" size={24} color="#6366f1" />
                  )}
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>
                    {trip.assignedCaptain.name}
                  </Text>
                  <Text style={styles.driverDetails}>
                    {trip.assignedCaptain.vehicle_type} •{" "}
                    {trip.assignedCaptain.registration_number}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={handleCallDriver}
                >
                  <Ionicons name="call" size={24} color="#6366f1" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Trip Info */}
          <View style={styles.tripInfoCard}>
            <Text style={styles.tripName}>{trip.name}</Text>
            {studentPoint && (
              <Text style={styles.pickupPoint}>
                📍 Pickup: {studentPoint.name}
              </Text>
            )}
            {trip.progress && (
              <Text style={styles.progressText}>
                Stop {trip.progress.currentPointIndex + 1} of{" "}
                {trip.points?.length || 0}
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "50%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  etaCard: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    margin: 15,
    borderRadius: 12,
  },
  etaLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 5,
  },
  etaValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#6366f1",
  },
  etaDistance: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 5,
  },
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
  tripInfoCard: {
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tripName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  pickupPoint: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  progressText: {
    fontSize: 14,
    color: "#6366f1",
    fontWeight: "500",
  },
  pickupMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  errorText: {
    fontSize: 18,
    color: "#ef4444",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#6366f1",
    padding: 15,
    borderRadius: 8,
    paddingHorizontal: 30,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});







