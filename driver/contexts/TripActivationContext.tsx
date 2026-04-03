import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { activateTrip as activateTripApi } from "@/services/tripActivationService";
import { useDriver } from "@/contexts/DriverContext";

interface TripActivationContextType {
  activeTripId: string | null;
  activatingTripId: string | null;
  activationVersion: number;
  activateTrip: (params: {
    tripId: string;
    latitude: number;
    longitude: number;
  }) => Promise<void>;
  markTripActive: (tripId: string) => Promise<void>;
  clearActiveTrip: () => Promise<void>;
}

const TripActivationContext = createContext<TripActivationContextType | undefined>(
  undefined
);

export function TripActivationProvider({ children }: { children: ReactNode }) {
  const { driver } = useDriver();
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [activatingTripId, setActivatingTripId] = useState<string | null>(null);
  const [activationVersion, setActivationVersion] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem("activeTripId")
      .then((storedTripId) => {
        setActiveTripId(storedTripId || null);
      })
      .catch((error) => {
        console.error("Error restoring activeTripId:", error);
      });
  }, []);

  const markTripActive = useCallback(async (tripId: string) => {
    setActiveTripId(tripId);
    await AsyncStorage.setItem("activeTripId", tripId);
    setActivationVersion((value) => value + 1);
  }, []);

  const clearActiveTrip = useCallback(async () => {
    setActiveTripId(null);
    await AsyncStorage.removeItem("activeTripId");
    setActivationVersion((value) => value + 1);
  }, []);

  const activateTrip = useCallback(
    async ({
      tripId,
      latitude,
      longitude,
    }: {
      tripId: string;
      latitude: number;
      longitude: number;
    }) => {
      if (activatingTripId) {
        throw new Error("Trip activation already in progress");
      }

      if (activeTripId && activeTripId !== tripId) {
        throw new Error("Another trip is already active");
      }

      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        throw new Error("Please login first");
      }

      if (!driver?.id) {
        throw new Error("Driver profile not loaded");
      }

      setActivatingTripId(tripId);
      try {
        const response = await activateTripApi({
          accessToken,
          tripId,
          driverId: driver.id,
          latitude,
          longitude,
        });

        if (!response.data?.success) {
          throw new Error(response.data?.message || "Failed to activate trip");
        }

        await markTripActive(tripId);
      } finally {
        setActivatingTripId(null);
      }
    },
    [activatingTripId, activeTripId, driver?.id, markTripActive]
  );

  const value = useMemo(
    () => ({
      activeTripId,
      activatingTripId,
      activationVersion,
      activateTrip,
      markTripActive,
      clearActiveTrip,
    }),
    [
      activeTripId,
      activatingTripId,
      activationVersion,
      activateTrip,
      markTripActive,
      clearActiveTrip,
    ]
  );

  return (
    <TripActivationContext.Provider value={value}>
      {children}
    </TripActivationContext.Provider>
  );
}

export const useTripActivation = () => {
  const context = useContext(TripActivationContext);
  if (!context) {
    throw new Error("useTripActivation must be used within TripActivationProvider");
  }
  return context;
};
