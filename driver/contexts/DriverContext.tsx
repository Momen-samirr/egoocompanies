import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "@/lib/apiClient";
import { getServerUri } from "@/configs/constants";

interface Driver {
  id: string;
  name: string;
  phone_number: string;
  email?: string;
  rate?: string;
  vehicle_type?: string;
  status?: string;
  notificationToken?: string;
  [key: string]: any;
}

interface DriverContextType {
  driver: Driver | null;
  loading: boolean;
  error: string | null;
  refreshDriver: () => Promise<void>;
  updateDriver: (updates: Partial<Driver>) => void;
}

const DriverContext = createContext<DriverContextType | undefined>(undefined);

interface DriverProviderProps {
  children: ReactNode;
}

/**
 * Driver Context Provider
 * Manages driver data globally to avoid refetching in multiple components
 */
export function DriverProvider({ children }: DriverProviderProps) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDriverData = async () => {
    try {
      setLoading(true);
      setError(null);

      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setDriver(null);
        setLoading(false);
        return;
      }

      const response = await apiClient.get<{ driver: Driver }>("/driver/me");
      
      if (response.data.driver) {
        setDriver(response.data.driver);
      } else {
        setError("No driver data found");
      }
    } catch (err: any) {
      console.error("Error fetching driver data:", err);
      setError(err.response?.data?.message || "Failed to load driver data");
      
      // Clear driver data on 401 (unauthorized)
      if (err.response?.status === 401) {
        setDriver(null);
        await AsyncStorage.removeItem("accessToken");
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshDriver = async () => {
    await fetchDriverData();
  };

  const updateDriver = (updates: Partial<Driver>) => {
    if (driver) {
      setDriver({ ...driver, ...updates });
    }
  };

  useEffect(() => {
    fetchDriverData();
  }, []);

  const value: DriverContextType = {
    driver,
    loading,
    error,
    refreshDriver,
    updateDriver,
  };

  return (
    <DriverContext.Provider value={value}>
      {children}
    </DriverContext.Provider>
  );
}

/**
 * Hook to use driver context
 * Throws error if used outside DriverProvider
 */
export function useDriver(): DriverContextType {
  const context = useContext(DriverContext);
  if (context === undefined) {
    throw new Error("useDriver must be used within a DriverProvider");
  }
  return context;
}

