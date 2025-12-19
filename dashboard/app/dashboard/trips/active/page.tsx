"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TripsView from "@/components/trips/TripsView";
import api from "@/lib/api";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";
import { MapIcon, TableCellsIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const libraries: ("drawing" | "geometry" | "places" | "visualization")[] = [
  "places",
];

interface ActiveTrip {
  id: string;
  name: string;
  status: string;
  assignedCaptain?: {
    id: string;
    name: string;
    phone_number: string;
  };
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  };
  nextCheckpoint?: {
    name: string;
    latitude: number;
    longitude: number;
  };
}

export default function ActiveTripsPage() {
  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const router = useRouter();
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey,
    libraries: libraries,
  });

  // Fetch active trips with live data
  useEffect(() => {
    const fetchActiveTrips = async () => {
      try {
        setLoading(true);
        const response = await api.get("/admin/trips/active/live");
        if (response.data.success) {
          setActiveTrips(response.data.trips);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching active trips:", error);
        setLoading(false);
      }
    };

    fetchActiveTrips();
    const interval = setInterval(fetchActiveTrips, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (viewMode === "table") {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setViewMode("map")} icon={MapIcon}>
            Map View
          </Button>
        </div>
        <TripsView view="active" title="Active Trips" />
      </div>
    );
  }

  if (!googleMapsApiKey) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Google Maps API Key is missing</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading Google Maps</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading map..." />
      </div>
    );
  }

  const tripsWithLocation = activeTrips.filter((trip) => trip.currentLocation);

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Active Trips</h1>
            <p className="text-sm text-gray-500">
              {activeTrips.length} active trip(s)
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setViewMode("table")}
              icon={TableCellsIcon}
              variant="outline"
            >
              Table View
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={
            tripsWithLocation.length > 0 &&
            tripsWithLocation[0].currentLocation &&
            typeof tripsWithLocation[0].currentLocation.latitude === "number" &&
            typeof tripsWithLocation[0].currentLocation.longitude ===
              "number" &&
            !isNaN(tripsWithLocation[0].currentLocation.latitude) &&
            !isNaN(tripsWithLocation[0].currentLocation.longitude) &&
            isFinite(tripsWithLocation[0].currentLocation.latitude) &&
            isFinite(tripsWithLocation[0].currentLocation.longitude)
              ? {
                  lat: tripsWithLocation[0].currentLocation.latitude,
                  lng: tripsWithLocation[0].currentLocation.longitude,
                }
              : { lat: 0, lng: 0 }
          }
          zoom={12}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
          }}
        >
          {tripsWithLocation
            .filter(
              (trip) =>
                trip.currentLocation &&
                typeof trip.currentLocation.latitude === "number" &&
                typeof trip.currentLocation.longitude === "number" &&
                !isNaN(trip.currentLocation.latitude) &&
                !isNaN(trip.currentLocation.longitude) &&
                isFinite(trip.currentLocation.latitude) &&
                isFinite(trip.currentLocation.longitude)
            )
            .map((trip) => {
              return (
                <Marker
                  key={trip.id}
                  position={{
                    lat: trip.currentLocation!.latitude,
                    lng: trip.currentLocation!.longitude,
                  }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: "#3B82F6",
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 2,
                  }}
                  onClick={() => setSelectedTrip(trip.id)}
                  title={trip.name}
                />
              );
            })}

          {selectedTrip &&
            (() => {
              const selectedTripData = tripsWithLocation.find(
                (t) => t.id === selectedTrip
              );
              if (
                !selectedTripData?.currentLocation ||
                typeof selectedTripData.currentLocation.latitude !== "number" ||
                typeof selectedTripData.currentLocation.longitude !==
                  "number" ||
                isNaN(selectedTripData.currentLocation.latitude) ||
                isNaN(selectedTripData.currentLocation.longitude) ||
                !isFinite(selectedTripData.currentLocation.latitude) ||
                !isFinite(selectedTripData.currentLocation.longitude)
              ) {
                return null;
              }
              return (
                <InfoWindow
                  position={{
                    lat: selectedTripData.currentLocation.latitude,
                    lng: selectedTripData.currentLocation.longitude,
                  }}
                  onCloseClick={() => setSelectedTrip(null)}
                >
                  <div className="p-2">
                    <h3 className="font-semibold text-gray-900">
                      {
                        tripsWithLocation.find((t) => t.id === selectedTrip)
                          ?.name
                      }
                    </h3>
                    <p className="text-sm text-gray-600">
                      Captain:{" "}
                      {tripsWithLocation.find((t) => t.id === selectedTrip)
                        ?.assignedCaptain?.name || "N/A"}
                    </p>
                    <button
                      onClick={() => {
                        router.push(`/dashboard/trips/${selectedTrip}`);
                        setSelectedTrip(null);
                      }}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      View Details →
                    </button>
                  </div>
                </InfoWindow>
              );
            })()}
        </GoogleMap>
      </div>

      {/* Trip List Sidebar */}
      <div className="bg-white border-t p-4 max-h-48 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeTrips.map((trip) => (
            <div
              key={trip.id}
              className="cursor-pointer"
              onClick={() => router.push(`/dashboard/trips/${trip.id}`)}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {trip.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {trip.assignedCaptain?.name || "No captain"}
                      </p>
                    </div>
                    {trip.currentLocation && (
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
