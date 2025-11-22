"use client";

import { useRef, useEffect, useState } from "react";
import { usePlacesAutocomplete } from "@/hooks/useGoogleMaps";
import { extractLocationFromPlace } from "@/lib/utils/maps";
import { LocationData } from "@/types/trip";
import { MagnifyingGlassIcon, MapPinIcon } from "@heroicons/react/24/outline";
import LoadingSpinner from "@/components/common/LoadingSpinner";

interface LocationAutocompleteProps {
  value?: LocationData;
  onChange: (location: LocationData | null) => void;
  onError?: (error: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export default function LocationAutocomplete({
  value,
  onChange,
  onError,
  placeholder = "Search for a location...",
  label,
  required = false,
  error,
  disabled = false,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const { isLoaded, loadError, getPlaceDetails } = usePlacesAutocomplete();
  const [isLoading, setIsLoading] = useState(false);
  const [searchValue, setSearchValue] = useState(value?.address || "");

  useEffect(() => {
    if (value?.address) {
      setSearchValue(value.address);
    }
  }, [value]);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || disabled) {
      return;
    }

    if (loadError) {
      onError?.("Failed to load Google Maps. Please check your API key.");
      return;
    }

    // Initialize Autocomplete
    const autocomplete = new google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ["establishment", "geocode"],
        fields: ["place_id", "geometry", "formatted_address", "address_components", "name"],
      }
    );

    autocompleteRef.current = autocomplete;

    // Handle place selection
    autocomplete.addListener("place_changed", async () => {
      const place = autocomplete.getPlace();

      if (!place.place_id) {
        onError?.("Please select a valid location from the suggestions.");
        return;
      }

      setIsLoading(true);

      try {
        // Get full place details
        const placeDetails = await getPlaceDetails(place.place_id);

        if (placeDetails) {
          const location = extractLocationFromPlace(placeDetails);

          if (location) {
            setSearchValue(location.address);
            onChange(location);
          } else {
            onError?.("Failed to extract location data.");
          }
        } else {
          // Fallback to basic place data
          if (place.geometry?.location) {
            const location: LocationData = {
              latitude: place.geometry.location.lat(),
              longitude: place.geometry.location.lng(),
              address: place.formatted_address || place.name || "",
              placeId: place.place_id,
            };
            setSearchValue(location.address);
            onChange(location);
          } else {
            onError?.("Invalid location selected.");
          }
        }
      } catch (err) {
        console.error("Error getting place details:", err);
        onError?.("An error occurred while processing the location.");
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, loadError, disabled, getPlaceDetails, onChange, onError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);

    // Clear location if input is cleared
    if (!newValue && value) {
      onChange(null);
    }
  };

  const handleClear = () => {
    setSearchValue("");
    onChange(null);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled || !isLoaded}
          className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-gray-300"
          } ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`}
        />

        {searchValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        )}
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

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <span>⚠</span>
          <span>{error}</span>
        </p>
      )}

      {!isLoaded && !loadError && (
        <p className="text-sm text-gray-500">Loading location services...</p>
      )}

      {loadError && (
        <p className="text-sm text-red-600">
          Failed to load Google Maps. Please refresh the page.
        </p>
      )}
    </div>
  );
}

