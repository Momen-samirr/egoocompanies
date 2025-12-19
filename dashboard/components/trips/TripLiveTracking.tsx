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
  eta?: {
    minutes?: number;
    method?: string;
    calculatedAt?: string;
    distanceMeters?: number;
  } | null;
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
          const route = trip.points
            .map((p: any) => ({
              lat: p.latitude,
              lng: p.longitude,
            }))
            .filter(
              (p: any) =>
                typeof p.lat === "number" &&
                typeof p.lng === "number" &&
                !isNaN(p.lat) &&
                !isNaN(p.lng) &&
                isFinite(p.lat) &&
                isFinite(p.lng)
            );
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
          const actual = trackingResponse.data.recentLocations
            .map((loc: any) => ({
              lat: loc.latitude,
              lng: loc.longitude,
            }))
            .filter(
              (p: any) =>
                typeof p.lat === "number" &&
                typeof p.lng === "number" &&
                !isNaN(p.lat) &&
                !isNaN(p.lng) &&
                isFinite(p.lat) &&
                isFinite(p.lng)
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
    // Remove trailing slashes to avoid double slashes in URL
    wsUrl = wsUrl.replace(/\/+$/, "");

    const token = getToken();
    const params = new URLSearchParams({ role: "admin" });
    if (token) {
      params.append("token", token);
    }
    // Ensure no trailing slash before query params
    const fullWsUrl = `${wsUrl}?${params.toString()}`;

    console.log(
      "🔌 [Trip Live Tracking] Connecting to WebSocket:",
      fullWsUrl.replace(/token=[^&]+/, "token=***")
    );

    const ws = new WebSocket(fullWsUrl);

    ws.onopen = () => {
      console.log("✅ [Trip Live Tracking] WebSocket connected");
      setIsConnected(true);

      // Subscribe to this trip (only send if connection is open)
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(
            JSON.stringify({
              type: "subscribeToTrip",
              tripId: tripId,
            })
          );
        } catch (error) {
          console.error(
            "❌ [Trip Live Tracking] Error sending subscription:",
            error
          );
        }
      }
    };

    ws.onclose = (event) => {
      console.log("🔌 [Trip Live Tracking] WebSocket disconnected", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      // WebSocket error events don't provide much detail, but we can log what we know
      console.error("❌ [Trip Live Tracking] WebSocket error occurred");
      console.error(
        "❌ [Trip Live Tracking] WebSocket URL:",
        fullWsUrl.replace(/token=[^&]+/, "token=***")
      );
      console.error(
        "❌ [Trip Live Tracking] WebSocket readyState:",
        ws.readyState
      );
      console.error("❌ [Trip Live Tracking] Error event:", error);
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

          // Update ETA if provided
          if (data.eta) {
            const methodLabel =
              data.eta.method === "google_maps" ? " (Traffic)" : "";
            setNextCheckpointETA(`${data.eta.minutes} min${methodLabel}`);
          }

          // Update actual route (validate coordinates first)
          if (
            typeof newLocation.latitude === "number" &&
            typeof newLocation.longitude === "number" &&
            !isNaN(newLocation.latitude) &&
            !isNaN(newLocation.longitude) &&
            isFinite(newLocation.latitude) &&
            isFinite(newLocation.longitude)
          ) {
            setActualRoute((prev) => [
              ...prev,
              { lat: newLocation.latitude, lng: newLocation.longitude },
            ]);
          }

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
          if (
            mapRef.current &&
            typeof newLocation.latitude === "number" &&
            typeof newLocation.longitude === "number" &&
            !isNaN(newLocation.latitude) &&
            !isNaN(newLocation.longitude) &&
            isFinite(newLocation.latitude) &&
            isFinite(newLocation.longitude)
          ) {
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
        // Only send unsubscribe if connection is open
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(
              JSON.stringify({
                type: "unsubscribeFromTrip",
                tripId: tripId,
              })
            );
          } catch (error) {
            console.debug("Error sending unsubscribe:", error);
          }
        }
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

  // Periodically fetch trip details to update checkpoint status
  useEffect(() => {
    const fetchTripDetails = async () => {
      try {
        const tripResponse = await api.get(`/admin/trips/${tripId}`);
        const trip = tripResponse.data.trip;

        if (trip.points && trip.points.length > 0) {
          const points = trip.points.map((p: any) => ({
            id: p.id,
            name: p.name || `Point ${p.order + 1}`,
            latitude: p.latitude,
            longitude: p.longitude,
            order: p.order,
            isFinalPoint: p.isFinalPoint || false,
            reachedAt: p.reachedAt,
          }));

          setCheckpoints(points);
        }
      } catch (error) {
        console.error("Error fetching updated trip details:", error);
      }
    };

    // Fetch every 10 seconds to update checkpoint status
    const interval = setInterval(fetchTripDetails, 10000);

    return () => clearInterval(interval);
  }, [tripId]);

  // Calculate trip progress based on checkpoints reached
  useEffect(() => {
    if (checkpoints.length > 0) {
      // Method 1: Use progress.currentPointIndex if available
      if (trackingData?.progress?.currentPointIndex !== undefined) {
        const progress =
          (trackingData.progress.currentPointIndex / checkpoints.length) * 100;
        setTripProgress(Math.min(progress, 100));
      }
      // Method 2: Calculate based on checkpoints reached (fallback)
      else {
        const reachedCount = checkpoints.filter(
          (cp) => cp.reachedAt !== null && cp.reachedAt !== undefined
        ).length;
        const progress = (reachedCount / checkpoints.length) * 100;
        setTripProgress(Math.min(progress, 100));
      }
    } else {
      setTripProgress(0);
    }
  }, [trackingData, checkpoints]);

  // Use ETA from backend (calculated with Google Maps API when available)
  useEffect(() => {
    if (
      trackingData?.eta?.minutes !== undefined &&
      trackingData.eta.minutes > 0
    ) {
      // Use accurate ETA from backend
      const methodLabel =
        trackingData.eta.method === "google_maps" ? " (Traffic)" : "";
      setNextCheckpointETA(`${trackingData.eta.minutes} min${methodLabel}`);
    } else if (
      trackingData?.currentLocation &&
      trackingData?.nextCheckpoint &&
      currentSpeed &&
      currentSpeed > 0
    ) {
      // Fallback: Simple ETA calculation if backend ETA not available
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
      setNextCheckpointETA(`${minutes} min (Est.)`);
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
        if (
          typeof point.lat === "number" &&
          typeof point.lng === "number" &&
          !isNaN(point.lat) &&
          !isNaN(point.lng) &&
          isFinite(point.lat) &&
          isFinite(point.lng)
        ) {
          bounds.extend(new google.maps.LatLng(point.lat, point.lng));
        }
      });

      // Add actual route
      actualRoute.forEach((point) => {
        if (
          typeof point.lat === "number" &&
          typeof point.lng === "number" &&
          !isNaN(point.lat) &&
          !isNaN(point.lng) &&
          isFinite(point.lat) &&
          isFinite(point.lng)
        ) {
          bounds.extend(new google.maps.LatLng(point.lat, point.lng));
        }
      });

      // Add checkpoints
      checkpoints.forEach((checkpoint) => {
        if (
          typeof checkpoint.latitude === "number" &&
          typeof checkpoint.longitude === "number" &&
          !isNaN(checkpoint.latitude) &&
          !isNaN(checkpoint.longitude) &&
          isFinite(checkpoint.latitude) &&
          isFinite(checkpoint.longitude)
        ) {
          bounds.extend(
            new google.maps.LatLng(checkpoint.latitude, checkpoint.longitude)
          );
        }
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
                // Validate coordinates before rendering
                if (
                  typeof prevLoc.latitude !== "number" ||
                  typeof prevLoc.longitude !== "number" ||
                  typeof loc.latitude !== "number" ||
                  typeof loc.longitude !== "number" ||
                  isNaN(prevLoc.latitude) ||
                  isNaN(prevLoc.longitude) ||
                  isNaN(loc.latitude) ||
                  isNaN(loc.longitude) ||
                  !isFinite(prevLoc.latitude) ||
                  !isFinite(prevLoc.longitude) ||
                  !isFinite(loc.latitude) ||
                  !isFinite(loc.longitude)
                ) {
                  return null;
                }
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
          {checkpoints
            .filter(
              (checkpoint) =>
                typeof checkpoint.latitude === "number" &&
                typeof checkpoint.longitude === "number" &&
                !isNaN(checkpoint.latitude) &&
                !isNaN(checkpoint.longitude) &&
                isFinite(checkpoint.latitude) &&
                isFinite(checkpoint.longitude)
            )
            .map((checkpoint, index) => {
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
          {currentLocation &&
            typeof currentLocation.latitude === "number" &&
            typeof currentLocation.longitude === "number" &&
            !isNaN(currentLocation.latitude) &&
            !isNaN(currentLocation.longitude) &&
            isFinite(currentLocation.latitude) &&
            isFinite(currentLocation.longitude) && (
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
