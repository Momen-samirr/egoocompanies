import { LocationData } from "@/types/trip";

export function extractLocationFromPlace(
  place: google.maps.places.PlaceResult
): LocationData | null {
  if (!place.geometry?.location) {
    return null;
  }

  const lat = place.geometry.location.lat();
  const lng = place.geometry.location.lng();

  // Extract address components
  const addressComponents = place.address_components || [];
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

  return {
    latitude: lat,
    longitude: lng,
    address: place.formatted_address || place.name || "",
    city,
    region,
    country,
    placeId: place.place_id,
  };
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function getDefaultMapCenter(): { lat: number; lng: number } {
  // Default to a common location (can be customized)
  return { lat: 23.8103, lng: 90.4125 }; // Dhaka, Bangladesh
}

export function getMapBoundsForLocations(
  locations: Array<{ latitude: number; longitude: number }>
): google.maps.LatLngBounds | null {
  if (locations.length === 0 || typeof window === "undefined" || !window.google) {
    return null;
  }

  const bounds = new window.google.maps.LatLngBounds();

  locations.forEach((location) => {
    bounds.extend(
      new window.google.maps.LatLng(location.latitude, location.longitude)
    );
  });

  return bounds;
}

