import React, { createContext, useContext, useState, ReactNode } from "react";
import { Coordinate } from "@/services/navigationService";
import { Route } from "@/services/navigationService";

export type NavigationMode = "pickup" | "destination" | null;

export interface NavigationContextType {
  isActive: boolean;
  mode: NavigationMode;
  origin: Coordinate | null;
  destination: Coordinate | null;
  route: Route | null;
  startNavigation: (origin: Coordinate, destination: Coordinate, mode: NavigationMode) => void;
  stopNavigation: () => void;
  updateDestination: (destination: Coordinate, mode: NavigationMode) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<NavigationMode>(null);
  const [origin, setOrigin] = useState<Coordinate | null>(null);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [route, setRoute] = useState<Route | null>(null);

  const startNavigation = (
    origin: Coordinate,
    destination: Coordinate,
    mode: NavigationMode
  ) => {
    setOrigin(origin);
    setDestination(destination);
    setMode(mode);
    setIsActive(true);
  };

  const stopNavigation = () => {
    setIsActive(false);
    setMode(null);
    setOrigin(null);
    setDestination(null);
    setRoute(null);
  };

  const updateDestination = (destination: Coordinate, mode: NavigationMode) => {
    setDestination(destination);
    setMode(mode);
    setRoute(null); // Clear route to force recalculation
  };

  return (
    <NavigationContext.Provider
      value={{
        isActive,
        mode,
        origin,
        destination,
        route,
        startNavigation,
        stopNavigation,
        updateDestination,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationContext() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error("useNavigationContext must be used within a NavigationProvider");
  }
  return context;
}

