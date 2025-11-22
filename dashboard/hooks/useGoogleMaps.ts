"use client";

import { useState, useEffect, useCallback } from "react";
import { useLoadScript } from "@react-google-maps/api";

const libraries: ("places" | "drawing" | "geometry")[] = ["places"];

export interface UseGoogleMapsReturn {
  isLoaded: boolean;
  loadError: Error | undefined;
  google: typeof window.google | undefined;
}

export function useGoogleMaps(): UseGoogleMapsReturn {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || "",
    libraries,
  });

  const [google, setGoogle] = useState<typeof window.google | undefined>(undefined);

  useEffect(() => {
    if (isLoaded && typeof window !== "undefined" && window.google) {
      setGoogle(window.google);
    }
  }, [isLoaded]);

  return {
    isLoaded,
    loadError,
    google,
  };
}

export function usePlacesAutocomplete() {
  const { isLoaded, loadError } = useGoogleMaps();

  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<google.maps.places.PlaceResult | null> => {
      if (!isLoaded || !window.google) {
        return null;
      }

      const service = new window.google.maps.places.PlacesService(
        document.createElement("div")
      );

      return new Promise((resolve) => {
        service.getDetails(
          {
            placeId,
            fields: [
              "geometry",
              "formatted_address",
              "address_components",
              "name",
            ],
          },
          (place, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
              resolve(place);
            } else {
              resolve(null);
            }
          }
        );
      });
    },
    [isLoaded]
  );

  return {
    isLoaded,
    loadError,
    getPlaceDetails,
  };
}

