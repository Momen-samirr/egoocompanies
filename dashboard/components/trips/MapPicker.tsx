"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { LocationData } from "@/types/trip";
import { getDefaultMapCenter, isValidCoordinate } from "@/lib/utils/maps";
import { MapPinIcon } from "@heroicons/react/24/outline";
import LoadingSpinner from "@/components/common/LoadingSpinner";

interface MapPickerProps {
  value?: LocationData;
  onChange: (location: LocationData | null) => void;
  onError?: (error: string) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  className?: string;
  disabled?: boolean;
}

const defaultMapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

export default function MapPicker({
  value,
  onChange,
  onError,
  center,
  zoom = 13,
  height = "400px",
  className = "",
  disabled = false,
}: MapPickerProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
    center || value ? { lat: value!.latitude, lng: value!.longitude } : getDefaultMapCenter()
  );
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(
    value ? { lat: value.latitude, lng: value.longitude } : null
  );
  const [isGeocoding, setIsGeocoding] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (value) {
      const newCenter = { lat: value.latitude, lng: value.longitude };
      setMapCenter(newCenter);
      setMarkerPosition(newCenter);
    } else if (center) {
      setMapCenter(center);
    }
  }, [value, center]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (disabled || !e.latLng) {
        return;
      }

      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      if (!isValidCoordinate(lat, lng)) {
        onError?.("Invalid coordinates selected.");
        return;
      }

      setMarkerPosition({ lat, lng });

      // Geocode the coordinates to get address
      setIsGeocoding(true);
      geocodeCoordinates(lat, lng);
    },
    [disabled, onError]
  );

  const geocodeCoordinates = useCallback(
    async (lat: number, lng: number) => {
      if (!isLoaded || !window.google) {
        setIsGeocoding(false);
        return;
      }

      try {
        const geocoder = new google.maps.Geocoder();

        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setIsGeocoding(false);

          if (status === "OK" && results && results.length > 0) {
            const result = results[0];
            const addressComponents = result.address_components || [];

            let city = "";
            let region = "";
            let country = "";

            addressComponents.forEach((component) => {
              const types = component.types;
              if (types.includes("locality")) {
                city = component.long_name;
              } else if (types.includes("administrative_area_level_1")) {
                region = component.long_name;
              } else if (types.includes("country")) {
                country = component.long_name;
              }
            });

            const location: LocationData = {
              latitude: lat,
              longitude: lng,
              address: result.formatted_address || "",
              city,
              region,
              country,
            };

            onChange(location);
          } else {
            // Still set coordinates even if geocoding fails
            const location: LocationData = {
              latitude: lat,
              longitude: lng,
              address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            };
            onChange(location);
            onError?.("Could not find address for this location.");
          }
        });
      } catch (error) {
        console.error("Geocoding error:", error);
        setIsGeocoding(false);
        const location: LocationData = {
          latitude: lat,
          longitude: lng,
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        };
        onChange(location);
        onError?.("Failed to get address for selected location.");
      }
    },
    [isLoaded, onChange, onError]
  );

  const handleUseCurrentLocation = useCallback(() => {
    if (disabled || !navigator.geolocation) {
      onError?.("Geolocation is not supported by your browser.");
      return;
    }

    setIsGeocoding(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (isValidCoordinate(lat, lng)) {
          setMapCenter({ lat, lng });
          setMarkerPosition({ lat, lng });
          geocodeCoordinates(lat, lng);
        } else {
          setIsGeocoding(false);
          onError?.("Invalid location coordinates.");
        }
      },
      (error) => {
        setIsGeocoding(false);
        onError?.("Failed to get your current location. Please allow location access.");
        console.error("Geolocation error:", error);
      }
    );
  }, [disabled, onError, geocodeCoordinates]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  if (loadError) {
    return (
      <div className={`border border-red-300 rounded-lg p-8 bg-red-50 ${className}`} style={{ height }}>
        <div className="text-center">
          <p className="text-red-600 font-medium">Failed to load map</p>
          <p className="text-red-500 text-sm mt-2">
            Please check your Google Maps API key configuration.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={`border border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 ${className}`}
        style={{ height }}
      >
        <LoadingSpinner text="Loading map..." />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {disabled
            ? "Click on the map to select a location"
            : "Click on the map to select a location"}
        </p>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={disabled || isGeocoding}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MapPinIcon className="h-4 w-4" />
          Use Current Location
        </button>
      </div>

      <div className="relative border border-gray-300 rounded-lg overflow-hidden" style={{ height }}>
        {isGeocoding && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <LoadingSpinner size="sm" />
              <span>Getting address...</span>
            </div>
          </div>
        )}

        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={mapCenter}
          zoom={zoom}
          options={defaultMapOptions}
          onClick={handleMapClick}
          onLoad={onMapLoad}
        >
          {markerPosition && (
            <Marker
              position={markerPosition}
              draggable={!disabled}
              onDragEnd={(e) => {
                if (e.latLng) {
                  const lat = e.latLng.lat();
                  const lng = e.latLng.lng();
                  setMarkerPosition({ lat, lng });
                  geocodeCoordinates(lat, lng);
                }
              }}
            />
          )}
        </GoogleMap>
      </div>

      {value && (
        <div className="flex items-start gap-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
          <MapPinIcon className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-indigo-900">{value.address}</div>
            {value.city && (
              <div className="text-indigo-700 mt-0.5">
                {[value.city, value.region, value.country]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
            <div className="text-indigo-600 text-xs mt-1">
              {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

