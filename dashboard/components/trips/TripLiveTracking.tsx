"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";
import api from "@/lib/api";
import { getToken } from "@/lib/auth";
import LoadingSpinner from "@/components/common/LoadingSpinner";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const libraries: ("drawing" | "geometry" | "places" | "visualization")[] = [
  "places",
];

interface TripLiveTrackingProps {
  tripId: string;
  onClose?: () => void;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  speed?: number;
  distanceFromRoute?: number;
  isRouteDeviation?: boolean;
}

interface Checkpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  isFinalPoint: boolean;
  reachedAt?: string | null;
}

interface LiveTrackingData {
  trip: {
    id: string;
    name: string;
    status: string;
    assignedCaptain?: {
      id: string;
      name: string;
      phone_number: string;
    };
  };
  currentLocation: LocationPoint | null;
  recentLocations: LocationPoint[];
  nextCheckpoint: Checkpoint | null;
  progress?: {
    currentPointIndex: number;
    startedAt?: string | null;
    lastLocationUpdate?: string | null;
  };
}

export default function TripLiveTracking({
  tripId,
  onClose,
}: TripLiveTrackingProps) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey,
    libraries: libraries,
  });

  const [trackingData, setTrackingData] = useState<LiveTrackingData | null>(
    null
  );
  const [plannedRoute, setPlannedRoute] = useState<
    Array<{ lat: number; lng: number }>
  >([]);
  const [actualRoute, setActualRoute] = useState<
    Array<{ lat: number; lng: number }>
  >([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [distanceFromRoute, setDistanceFromRoute] = useState<number | null>(
    null
  );
  const [nextCheckpointETA, setNextCheckpointETA] = useState<string | null>(
    null
  );
  const [tripProgress, setTripProgress] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial trip data and planned route
  useEffect(() => {
    const fetchTripData = async () => {
      try {
        setLoading(true);

        // Fetch trip details
        const tripResponse = await api.get(`/admin/trips/${tripId}`);
        const trip = tripResponse.data.trip;

        // Set planned route and checkpoints
        if (trip.points && trip.points.length > 0) {
          const route = trip.points.map((p: any) => ({
            lat: p.latitude,
            lng: p.longitude,
          }));
          setPlannedRoute(route);
          setCheckpoints(trip.points);
        }

        // Fetch live tracking data
        const trackingResponse = await api.get(
          `/admin/trips/${tripId}/live-tracking`
        );
        setTrackingData(trackingResponse.data);

        // Update actual route from recent locations
        if (trackingResponse.data.recentLocations) {
          const actual = trackingResponse.data.recentLocations.map(
            (loc: any) => ({
              lat: loc.latitude,
              lng: loc.longitude,
            })
          );
          setActualRoute(actual);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching trip data:", error);
        setLoading(false);
      }
    };

    fetchTripData();
  }, [tripId]);

  // Initialize WebSocket connection for live updates
  useEffect(() => {
    if (!tripId) return;

    let wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080";
    wsUrl = wsUrl.trim();
    if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
      wsUrl = `ws://${wsUrl}`;
    }
    wsUrl = wsUrl.replace(/\/$/, "");

    const token = getToken();
    const params = new URLSearchParams({ role: "admin" });
    if (token) {
      params.append("token", token);
    }
    const fullWsUrl = `${wsUrl}?${params.toString()}`;

    const ws = new WebSocket(fullWsUrl);

    ws.onopen = () => {
      console.log("✅ [Trip Live Tracking] WebSocket connected");
      setIsConnected(true);

      // Subscribe to this trip
      ws.send(
        JSON.stringify({
          type: "subscribeToTrip",
          tripId: tripId,
        })
      );
    };

    ws.onclose = () => {
      console.log("🔌 [Trip Live Tracking] WebSocket disconnected");
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("❌ [Trip Live Tracking] WebSocket error:", error);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "tripLocationUpdate" && data.tripId === tripId) {
          // Update current location
          const newLocation: LocationPoint = {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            timestamp: new Date(data.timestamp),
            speed: data.speed,
            distanceFromRoute: data.deviationStatus?.distance,
            isRouteDeviation: data.deviationStatus?.isDeviated,
          };

          setCurrentSpeed(data.speed || null);
          setDistanceFromRoute(data.deviationStatus?.distance || null);

          // Update actual route
          setActualRoute((prev) => [
            ...prev,
            { lat: newLocation.latitude, lng: newLocation.longitude },
          ]);

          // Update tracking data
          setTrackingData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              currentLocation: newLocation,
              recentLocations: [...prev.recentLocations.slice(-9), newLocation],
            };
          });

          // Center map on new location
          if (mapRef.current) {
            mapRef.current.setCenter({
              lat: newLocation.latitude,
              lng: newLocation.longitude,
            });
          }
        } else if (data.type === "tripAlert" && data.tripId === tripId) {
          console.log("🚨 Trip alert received:", data);
          // You can show alerts in a notification or alert panel
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "unsubscribeFromTrip",
            tripId: tripId,
          })
        );
        wsRef.current.close();
      }
    };
  }, [tripId]);

  // Poll for location updates as fallback
  useEffect(() => {
    const fetchLiveTracking = async () => {
      try {
        const response = await api.get(`/admin/trips/${tripId}/live-tracking`);
        const data = response.data;

        if (data.currentLocation) {
          const loc = data.currentLocation;
          setCurrentSpeed(loc.speed || null);
          setDistanceFromRoute(loc.distanceFromRoute || null);

          // Update actual route
          if (data.recentLocations) {
            const actual = data.recentLocations.map((l: any) => ({
              lat: l.latitude,
              lng: l.longitude,
            }));
            setActualRoute(actual);
          }
        }

        setTrackingData(data);
      } catch (error) {
        console.error("Error fetching live tracking:", error);
      }
    };

    // Poll every 5 seconds
    locationUpdateIntervalRef.current = setInterval(fetchLiveTracking, 5000);

    return () => {
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current);
      }
    };
  }, [tripId]);

  // Calculate trip progress
  useEffect(() => {
    if (trackingData?.progress && checkpoints.length > 0) {
      const progress =
        (trackingData.progress.currentPointIndex / checkpoints.length) * 100;
      setTripProgress(progress);
    }
  }, [trackingData, checkpoints]);

  // Calculate ETA to next checkpoint
  useEffect(() => {
    if (
      trackingData?.currentLocation &&
      trackingData?.nextCheckpoint &&
      currentSpeed &&
      currentSpeed > 0
    ) {
      // Simple ETA calculation (distance / speed)
      const distance =
        trackingData.currentLocation.distanceFromRoute ||
        calculateDistance(
          trackingData.currentLocation.latitude,
          trackingData.currentLocation.longitude,
          trackingData.nextCheckpoint.latitude,
          trackingData.nextCheckpoint.longitude
        );

      const hours = distance / (currentSpeed * 1000); // Convert speed from km/h to m/h
      const minutes = Math.round(hours * 60);
      setNextCheckpointETA(`${minutes} min`);
    } else {
      setNextCheckpointETA(null);
    }
  }, [trackingData, currentSpeed]);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Auto-fit map to show route
  useEffect(() => {
    if (isLoaded && mapRef.current && plannedRoute.length > 0) {
      const bounds = new google.maps.LatLngBounds();

      // Add planned route
      plannedRoute.forEach((point) => {
        bounds.extend(new google.maps.LatLng(point.lat, point.lng));
      });

      // Add actual route
      actualRoute.forEach((point) => {
        bounds.extend(new google.maps.LatLng(point.lat, point.lng));
      });

      // Add checkpoints
      checkpoints.forEach((checkpoint) => {
        bounds.extend(
          new google.maps.LatLng(checkpoint.latitude, checkpoint.longitude)
        );
      });

      if (bounds.getNorthEast() && bounds.getSouthWest()) {
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [isLoaded, plannedRoute, actualRoute, checkpoints]);

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

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading live tracking..." />
      </div>
    );
  }

  const currentLocation = trackingData?.currentLocation;

  return (
    <div className="h-full flex flex-col">
      {/* Stats Panel */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {trackingData?.trip.name || "Live Tracking"}
            </h2>
            <p className="text-sm text-gray-500">
              {trackingData?.trip.assignedCaptain?.name ||
                "No captain assigned"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 ${
                isConnected ? "text-green-600" : "text-red-600"
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm">
                {isConnected ? "Live" : "Disconnected"}
              </span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Close
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs text-gray-500">Current Speed</div>
            <div className="text-lg font-semibold">
              {currentSpeed !== null
                ? `${currentSpeed.toFixed(1)} km/h`
                : "N/A"}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs text-gray-500">Distance from Route</div>
            <div className="text-lg font-semibold">
              {distanceFromRoute !== null
                ? `${(distanceFromRoute / 1000).toFixed(2)} km`
                : "N/A"}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs text-gray-500">Next Checkpoint ETA</div>
            <div className="text-lg font-semibold">
              {nextCheckpointETA || "N/A"}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs text-gray-500">Trip Progress</div>
            <div className="text-lg font-semibold">
              {tripProgress.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          onLoad={onMapLoad}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
          }}
        >
          {/* Planned Route */}
          {plannedRoute.length > 1 && (
            <Polyline
              path={plannedRoute}
              options={{
                strokeColor: "#3B82F6",
                strokeOpacity: 0.6,
                strokeWeight: 4,
                zIndex: 1,
              }}
            />
          )}

          {/* Actual Route */}
          {actualRoute.length > 1 && (
            <Polyline
              path={actualRoute}
              options={{
                strokeColor: "#10B981",
                strokeOpacity: 0.8,
                strokeWeight: 3,
                zIndex: 2,
              }}
            />
          )}

          {/* Deviation Segments */}
          {trackingData?.recentLocations &&
            trackingData.recentLocations
              .filter((loc) => loc.isRouteDeviation)
              .map((loc, index, arr) => {
                if (index === 0) return null;
                const prevLoc = arr[index - 1];
                return (
                  <Polyline
                    key={`deviation-${index}`}
                    path={[
                      { lat: prevLoc.latitude, lng: prevLoc.longitude },
                      { lat: loc.latitude, lng: loc.longitude },
                    ]}
                    options={{
                      strokeColor: "#EF4444",
                      strokeOpacity: 0.8,
                      strokeWeight: 4,
                      zIndex: 3,
                    }}
                  />
                );
              })}

          {/* Checkpoints */}
          {checkpoints.map((checkpoint, index) => {
            const isReached = checkpoint.reachedAt !== null;
            const isCurrent =
              trackingData?.progress?.currentPointIndex === checkpoint.order;

            return (
              <Marker
                key={checkpoint.id}
                position={{
                  lat: checkpoint.latitude,
                  lng: checkpoint.longitude,
                }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isCurrent ? 10 : isReached ? 8 : 6,
                  fillColor: isCurrent
                    ? "#3B82F6"
                    : isReached
                    ? "#10B981"
                    : "#6B7280",
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 2,
                }}
                label={{
                  text: `${checkpoint.order + 1}`,
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
                title={checkpoint.name}
              />
            );
          })}

          {/* Current Driver Location */}
          {currentLocation && (
            <Marker
              position={{
                lat: currentLocation.latitude,
                lng: currentLocation.longitude,
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: "#EF4444",
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 3,
              }}
              title="Current Location"
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
