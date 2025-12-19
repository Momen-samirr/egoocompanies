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
import Card, { CardHeader, CardBody } from "@/components/common/Card";
import { getDistance } from "geolib";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const libraries: ("drawing" | "geometry" | "places" | "visualization")[] = [
  "places",
];

interface RouteComparisonProps {
  tripId: string;
}

interface RouteAnalysis {
  plannedRoute: Array<{ lat: number; lng: number }>;
  actualPath: Array<{ lat: number; lng: number }>;
  plannedDistance: number;
  actualDistance: number;
  routeEfficiency: number;
  deviationSegments: Array<{
    start: { lat: number; lng: number; timestamp: Date };
    end: { lat: number; lng: number; timestamp: Date };
    maxDeviation: number;
    duration: number;
  }>;
  statistics: {
    totalDeviationDistance: number;
    averageDeviation: number;
    largestDeviation: number;
    deviationCount: number;
  };
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

interface RouteSegment {
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  distance: number; // meters
  estimatedTime: number; // minutes
  name: string;
  checkpointIndex: number;
}

interface DriverLocation {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
}

export default function RouteComparison({ tripId }: RouteComparisonProps) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey,
    libraries: libraries,
  });

  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"overlay" | "side-by-side">(
    "overlay"
  );
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);

  // Live tracking state
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [tripStatus, setTripStatus] = useState<string | null>(null);
  const [currentDriverLocation, setCurrentDriverLocation] =
    useState<DriverLocation | null>(null);
  const [liveActualPath, setLiveActualPath] = useState<
    Array<{ lat: number; lng: number }>
  >([]);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [nextCheckpoint, setNextCheckpoint] = useState<Checkpoint | null>(null);
  const [etaToNextCheckpoint, setEtaToNextCheckpoint] = useState<string | null>(
    null
  );
  const [isConnected, setIsConnected] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [distanceFromRoute, setDistanceFromRoute] = useState<number | null>(
    null
  );
  const [tripProgress, setTripProgress] = useState<number>(0);
  const [followDriver, setFollowDriver] = useState(true);
  const [showRouteSteps, setShowRouteSteps] = useState(true);
  const [recentSpeeds, setRecentSpeeds] = useState<number[]>([]); // For average speed calculation

  const mapRef = useRef<google.maps.Map | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Calculate route segments from trip points
  const calculateRouteSegments = useCallback(
    (points: Checkpoint[]): RouteSegment[] => {
      if (points.length < 2) return [];

      const segments: RouteSegment[] = [];

      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];

        const distance = getDistance(
          { latitude: start.latitude, longitude: start.longitude },
          { latitude: end.latitude, longitude: end.longitude }
        );

        // Estimate time based on average speed (50 km/h default)
        const averageSpeedKmh = 50;
        const estimatedTimeMinutes = (distance / 1000 / averageSpeedKmh) * 60;

        segments.push({
          start: { lat: start.latitude, lng: start.longitude },
          end: { lat: end.latitude, lng: end.longitude },
          distance,
          estimatedTime: estimatedTimeMinutes,
          name: end.name || `Checkpoint ${end.order + 1}`,
          checkpointIndex: i + 1,
        });
      }

      return segments;
    },
    []
  );

  // Fetch trip details to get status and checkpoints
  useEffect(() => {
    const fetchTripDetails = async () => {
      try {
        const tripResponse = await api.get(`/admin/trips/${tripId}`);
        const trip = tripResponse.data.trip;

        setTripStatus(trip.status);

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
          const segments = calculateRouteSegments(points);
          setRouteSegments(segments);

          // Set next checkpoint (first unreached checkpoint)
          const nextUnreached = points.find((p: Checkpoint) => !p.reachedAt);
          setNextCheckpoint(nextUnreached || null);
        }
      } catch (error) {
        console.error("Error fetching trip details:", error);
      }
    };

    fetchTripDetails();
  }, [tripId, calculateRouteSegments]);

  // Periodically fetch trip details to update checkpoint status in live mode
  useEffect(() => {
    if (!isLiveMode || tripStatus !== "ACTIVE") {
      return;
    }

    const interval = setInterval(async () => {
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

          // Update next checkpoint (first unreached checkpoint)
          const nextUnreached = points.find((p: Checkpoint) => !p.reachedAt);
          setNextCheckpoint(nextUnreached || null);
        }
      } catch (error) {
        console.error("Error fetching updated trip details:", error);
      }
    }, 10000); // Fetch every 10 seconds

    return () => clearInterval(interval);
  }, [isLiveMode, tripStatus, tripId]);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/trips/${tripId}/route-analysis`);
        const data = response.data;

        // Convert coordinate format from { latitude, longitude } to { lat, lng }
        if (data.plannedRoute) {
          data.plannedRoute = data.plannedRoute
            .map((p: any) => ({
              lat: p.latitude || p.lat,
              lng: p.longitude || p.lng,
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
        }

        if (data.actualPath) {
          data.actualPath = data.actualPath
            .map((p: any) => ({
              lat: p.latitude || p.lat,
              lng: p.longitude || p.lng,
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
        }

        // Convert deviation segments coordinates
        if (data.deviationSegments) {
          data.deviationSegments = data.deviationSegments.map((seg: any) => ({
            ...seg,
            start: {
              lat: seg.start.latitude || seg.start.lat,
              lng: seg.start.longitude || seg.start.lng,
              timestamp: new Date(seg.start.timestamp),
            },
            end: {
              lat: seg.end.latitude || seg.end.lat,
              lng: seg.end.longitude || seg.end.lng,
              timestamp: new Date(seg.end.timestamp),
            },
            maxDeviation: seg.maxDeviation,
            duration: seg.duration,
          }));
        }

        setAnalysis(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching route analysis:", error);
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [tripId]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Helper function to calculate path distance
  const calculatePathDistance = useCallback(
    (path: Array<{ lat: number; lng: number }>): number => {
      if (path.length < 2) return 0;

      let totalDistance = 0;

      for (let i = 0; i < path.length - 1; i++) {
        totalDistance += getDistance(
          { latitude: path[i].lat, longitude: path[i].lng },
          { latitude: path[i + 1].lat, longitude: path[i + 1].lng }
        );
      }

      return totalDistance;
    },
    []
  );

  // Auto-center map on driver location in live mode
  useEffect(() => {
    if (
      isLiveMode &&
      followDriver &&
      currentDriverLocation &&
      mapRef.current &&
      isLoaded
    ) {
      mapRef.current.panTo({
        lat: currentDriverLocation.lat,
        lng: currentDriverLocation.lng,
      });
    }
  }, [isLiveMode, followDriver, currentDriverLocation, isLoaded]);

  // WebSocket connection for live tracking
  useEffect(() => {
    if (!isLiveMode || tripStatus !== "ACTIVE") {
      // Close WebSocket if live mode is disabled or trip is not active
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setIsConnected(false);
      }
      return;
    }

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
      "🔌 [Route Comparison] Connecting to WebSocket:",
      fullWsUrl.replace(/token=[^&]+/, "token=***")
    );

    const ws = new WebSocket(fullWsUrl);

    ws.onopen = () => {
      console.log("✅ [Route Comparison] WebSocket connected");
      setIsConnected(true);

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
            "❌ [Route Comparison] Error sending subscription:",
            error
          );
        }
      }
    };

    ws.onclose = (event) => {
      console.log("🔌 [Route Comparison] WebSocket disconnected", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      setIsConnected(false);

      // Attempt to reconnect after 3 seconds if still in live mode and not a normal closure
      if (isLiveMode && tripStatus === "ACTIVE" && event.code !== 1000) {
        setTimeout(() => {
          if (isLiveMode && tripStatus === "ACTIVE" && !wsRef.current) {
            // Trigger reconnection by updating a dependency
            setIsConnected(false);
          }
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      // WebSocket error events don't provide much detail, but we can log what we know
      console.error("❌ [Route Comparison] WebSocket error occurred");
      console.error(
        "❌ [Route Comparison] WebSocket URL:",
        fullWsUrl.replace(/token=[^&]+/, "token=***")
      );
      console.error(
        "❌ [Route Comparison] WebSocket readyState:",
        ws.readyState
      );
      console.error("❌ [Route Comparison] Error event:", error);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "tripLocationUpdate" && data.tripId === tripId) {
          const location = data.location;

          // Validate coordinates
          if (
            location &&
            typeof location.latitude === "number" &&
            typeof location.longitude === "number" &&
            !isNaN(location.latitude) &&
            !isNaN(location.longitude) &&
            isFinite(location.latitude) &&
            isFinite(location.longitude) &&
            location.latitude >= -90 &&
            location.latitude <= 90 &&
            location.longitude >= -180 &&
            location.longitude <= 180
          ) {
            const driverLoc: DriverLocation = {
              lat: location.latitude,
              lng: location.longitude,
              speed: data.speed,
              heading: location.heading,
              timestamp: new Date(data.timestamp),
            };

            setCurrentDriverLocation(driverLoc);
            const speed = data.speed || 0;
            setCurrentSpeed(speed > 0 ? speed : null);
            setDistanceFromRoute(data.deviationStatus?.distance || null);

            // Update recent speeds for average calculation (keep last 10 speeds)
            if (speed > 0) {
              setRecentSpeeds((prev) => {
                const updated = [...prev, speed];
                return updated.slice(-10); // Keep last 10 speeds
              });
            }

            // Update live actual path
            setLiveActualPath((prev) => [
              ...prev,
              { lat: driverLoc.lat, lng: driverLoc.lng },
            ]);

            // Calculate ETA to next checkpoint with fallbacks
            if (nextCheckpoint) {
              const distanceToCheckpoint = getDistance(
                { latitude: driverLoc.lat, longitude: driverLoc.lng },
                {
                  latitude: nextCheckpoint.latitude,
                  longitude: nextCheckpoint.longitude,
                }
              );

              // Use current speed, or average speed, or default 30 km/h
              let effectiveSpeed = speed;
              if (effectiveSpeed <= 0 && recentSpeeds.length > 0) {
                // Calculate average speed from recent speeds
                effectiveSpeed =
                  recentSpeeds.reduce((sum, s) => sum + s, 0) /
                  recentSpeeds.length;
              }
              if (effectiveSpeed <= 0) {
                effectiveSpeed = 30; // Default to 30 km/h if no speed data
              }

              if (effectiveSpeed > 0 && distanceToCheckpoint > 0) {
                const speedMs = (effectiveSpeed * 1000) / 3600; // Convert km/h to m/s
                const etaSeconds = distanceToCheckpoint / speedMs;
                const etaMinutes = Math.round(etaSeconds / 60);

                if (speed <= 0 && recentSpeeds.length === 0) {
                  setEtaToNextCheckpoint("Stopped");
                } else if (etaMinutes < 1) {
                  setEtaToNextCheckpoint("< 1 min");
                } else {
                  setEtaToNextCheckpoint(`${etaMinutes} min`);
                }
              } else {
                setEtaToNextCheckpoint("Calculating...");
              }
            } else {
              // All checkpoints reached
              setEtaToNextCheckpoint("Trip Complete");
            }

            // Check if driver is near a checkpoint and update nextCheckpoint
            if (checkpoints.length > 0) {
              const CHECKPOINT_PROXIMITY_THRESHOLD = 50; // meters

              // Find the closest unreached checkpoint
              let closestUnreached: Checkpoint | null = null;
              let minDistance = Infinity;

              for (const checkpoint of checkpoints) {
                if (!checkpoint.reachedAt) {
                  const distance = getDistance(
                    { latitude: driverLoc.lat, longitude: driverLoc.lng },
                    {
                      latitude: checkpoint.latitude,
                      longitude: checkpoint.longitude,
                    }
                  );

                  if (distance < minDistance) {
                    minDistance = distance;
                    closestUnreached = checkpoint;
                  }

                  // If driver is very close to a checkpoint, mark it as reached (frontend only)
                  // The backend will update this when the checkpoint is actually reached
                  if (distance < CHECKPOINT_PROXIMITY_THRESHOLD) {
                    // Update checkpoint in local state (optimistic update)
                    setCheckpoints((prev) =>
                      prev.map((cp) =>
                        cp.id === checkpoint.id
                          ? { ...cp, reachedAt: new Date().toISOString() }
                          : cp
                      )
                    );
                  }
                }
              }

              // Update nextCheckpoint to the closest unreached checkpoint
              if (closestUnreached) {
                setNextCheckpoint(closestUnreached);
              } else {
                // All checkpoints reached
                setNextCheckpoint(null);
                setEtaToNextCheckpoint("Trip Complete");
              }
            }

            // Calculate trip progress
            if (analysis && analysis.plannedDistance > 0) {
              const updatedPath = [
                ...liveActualPath,
                { lat: driverLoc.lat, lng: driverLoc.lng },
              ];
              const completedDistance = calculatePathDistance(updatedPath);
              const progress = Math.min(
                (completedDistance / analysis.plannedDistance) * 100,
                100
              );
              setTripProgress(progress);
            }
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setIsConnected(false);
      }
    };
  }, [
    isLiveMode,
    tripStatus,
    tripId,
    nextCheckpoint,
    analysis,
    liveActualPath,
    calculatePathDistance,
  ]);

  // Auto-fit map to show both routes
  useEffect(() => {
    if (
      isLoaded &&
      mapRef.current &&
      analysis &&
      (analysis.plannedRoute.length > 0 || analysis.actualPath.length > 0)
    ) {
      const bounds = new google.maps.LatLngBounds();
      let hasValidPoints = false;

      analysis.plannedRoute.forEach((point) => {
        if (
          typeof point.lat === "number" &&
          typeof point.lng === "number" &&
          !isNaN(point.lat) &&
          !isNaN(point.lng) &&
          isFinite(point.lat) &&
          isFinite(point.lng)
        ) {
          bounds.extend(new google.maps.LatLng(point.lat, point.lng));
          hasValidPoints = true;
        }
      });

      analysis.actualPath.forEach((point) => {
        if (
          typeof point.lat === "number" &&
          typeof point.lng === "number" &&
          !isNaN(point.lat) &&
          !isNaN(point.lng) &&
          isFinite(point.lat) &&
          isFinite(point.lng)
        ) {
          bounds.extend(new google.maps.LatLng(point.lat, point.lng));
          hasValidPoints = true;
        }
      });

      if (hasValidPoints && bounds.getNorthEast() && bounds.getSouthWest()) {
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [isLoaded, analysis]);

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
        <LoadingSpinner size="lg" text="Loading route analysis..." />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600">No route analysis available</p>
        </div>
      </div>
    );
  }

  // Check if we have any route data to display
  const hasPlannedRoute =
    analysis.plannedRoute && analysis.plannedRoute.length > 0;
  const hasActualPath = analysis.actualPath && analysis.actualPath.length > 0;

  if (!hasPlannedRoute && !hasActualPath) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardBody>
              <div className="text-sm text-gray-500">Planned Distance</div>
              <div className="text-2xl font-semibold">
                {(analysis.plannedDistance / 1000).toFixed(2)} km
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-500">Actual Distance</div>
              <div className="text-2xl font-semibold">
                {(analysis.actualDistance / 1000).toFixed(2)} km
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-500">Route Efficiency</div>
              <div className="text-2xl font-semibold">
                {analysis.routeEfficiency.toFixed(1)}%
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-500">Largest Deviation</div>
              <div className="text-2xl font-semibold">
                {(analysis.statistics.largestDeviation / 1000).toFixed(2)} km
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center">
            <p className="text-gray-600 text-lg mb-2">
              No route data available
            </p>
            <p className="text-gray-500 text-sm">
              {!hasPlannedRoute && !hasActualPath
                ? "This trip has no planned route points or location history to display."
                : !hasPlannedRoute
                ? "No planned route points found."
                : "No location history found for this trip."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isLiveMode ? (
          <>
            <Card>
              <CardBody>
                <div className="text-sm text-gray-500">Current Speed</div>
                <div className="text-2xl font-semibold">
                  {currentSpeed !== null
                    ? `${currentSpeed.toFixed(0)} km/h`
                    : "N/A"}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-sm text-gray-500">Distance from Route</div>
                <div className="text-2xl font-semibold">
                  {distanceFromRoute !== null
                    ? `${(distanceFromRoute / 1000).toFixed(2)} km`
                    : "N/A"}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-sm text-gray-500">Trip Progress</div>
                <div className="text-2xl font-semibold">
                  {tripProgress.toFixed(1)}%
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${tripProgress}%` }}
                  />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-sm text-gray-500">
                  {nextCheckpoint ? `ETA to ${nextCheckpoint.name}` : "ETA"}
                </div>
                <div className="text-2xl font-semibold">
                  {etaToNextCheckpoint || "N/A"}
                </div>
              </CardBody>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardBody>
                <div className="text-sm text-gray-500">Planned Distance</div>
                <div className="text-2xl font-semibold">
                  {(analysis.plannedDistance / 1000).toFixed(2)} km
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-sm text-gray-500">Actual Distance</div>
                <div className="text-2xl font-semibold">
                  {(analysis.actualDistance / 1000).toFixed(2)} km
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-sm text-gray-500">Route Efficiency</div>
                <div className="text-2xl font-semibold">
                  {analysis.routeEfficiency.toFixed(1)}%
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-sm text-gray-500">Largest Deviation</div>
                <div className="text-2xl font-semibold">
                  {(analysis.statistics.largestDeviation / 1000).toFixed(2)} km
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>

      {/* Mode Toggle and Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Mode:</span>
          <button
            onClick={() => {
              setIsLiveMode(false);
              setLiveActualPath([]);
              setCurrentDriverLocation(null);
            }}
            className={`px-4 py-2 rounded transition-colors ${
              !isLiveMode
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Historical Analysis
          </button>
          <button
            onClick={() => {
              if (tripStatus === "ACTIVE") {
                setIsLiveMode(true);
              }
            }}
            disabled={tripStatus !== "ACTIVE"}
            className={`px-4 py-2 rounded transition-colors ${
              isLiveMode
                ? "bg-green-600 text-white"
                : tripStatus === "ACTIVE"
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            Live Tracking
            {tripStatus === "ACTIVE" && isLiveMode && (
              <span
                className={`ml-2 inline-block w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
                }`}
              />
            )}
          </button>
          {tripStatus !== "ACTIVE" && (
            <span className="text-xs text-gray-500">
              (Only available for ACTIVE trips)
            </span>
          )}
        </div>

        {isLiveMode && (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={followDriver}
                onChange={(e) => setFollowDriver(e.target.checked)}
                className="rounded"
              />
              Follow Driver
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showRouteSteps}
                onChange={(e) => setShowRouteSteps(e.target.checked)}
                className="rounded"
              />
              Show Route Steps
            </label>
          </div>
        )}

        {!isLiveMode && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              View Mode:
            </span>
            <button
              onClick={() => setViewMode("overlay")}
              className={`px-4 py-2 rounded ${
                viewMode === "overlay"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Overlay
            </button>
            <button
              onClick={() => setViewMode("side-by-side")}
              className={`px-4 py-2 rounded ${
                viewMode === "side-by-side"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Side by Side
            </button>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="h-[600px] relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          onLoad={onMapLoad}
          center={
            hasPlannedRoute && analysis.plannedRoute.length > 0
              ? {
                  lat: analysis.plannedRoute[0].lat,
                  lng: analysis.plannedRoute[0].lng,
                }
              : hasActualPath && analysis.actualPath.length > 0
              ? {
                  lat: analysis.actualPath[0].lat,
                  lng: analysis.actualPath[0].lng,
                }
              : { lat: 0, lng: 0 }
          }
          zoom={hasPlannedRoute || hasActualPath ? 12 : 2}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
          }}
        >
          {/* Planned Route */}
          {analysis.plannedRoute.length > 1 && (
            <Polyline
              path={analysis.plannedRoute}
              options={{
                strokeColor: "#3B82F6",
                strokeOpacity: isLiveMode ? 0.8 : 0.6,
                strokeWeight: isLiveMode ? 6 : 4,
                zIndex: 1,
              }}
            />
          )}

          {/* Actual Route - Live or Historical */}
          {isLiveMode
            ? liveActualPath.length > 1 && (
                <Polyline
                  path={liveActualPath}
                  options={{
                    strokeColor: "#10B981",
                    strokeOpacity: 0.9,
                    strokeWeight: 4,
                    zIndex: 2,
                  }}
                />
              )
            : analysis.actualPath.length > 1 && (
                <Polyline
                  path={analysis.actualPath}
                  options={{
                    strokeColor: "#10B981",
                    strokeOpacity: 0.8,
                    strokeWeight: 3,
                    zIndex: 2,
                  }}
                />
              )}

          {/* Start Marker */}
          {analysis.plannedRoute.length > 0 && (
            <Marker
              position={analysis.plannedRoute[0]}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#10B981",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }}
              label={{
                text: "START",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "bold",
              }}
              zIndex={10}
            />
          )}

          {/* End Marker */}
          {analysis.plannedRoute.length > 0 && (
            <Marker
              position={analysis.plannedRoute[analysis.plannedRoute.length - 1]}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#EF4444",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }}
              label={{
                text: "END",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "bold",
              }}
              zIndex={10}
            />
          )}

          {/* Driver Marker (Live Mode) */}
          {isLiveMode &&
            currentDriverLocation &&
            typeof currentDriverLocation.lat === "number" &&
            typeof currentDriverLocation.lng === "number" &&
            !isNaN(currentDriverLocation.lat) &&
            !isNaN(currentDriverLocation.lng) &&
            isFinite(currentDriverLocation.lat) &&
            isFinite(currentDriverLocation.lng) && (
              <Marker
                position={{
                  lat: currentDriverLocation.lat,
                  lng: currentDriverLocation.lng,
                }}
                icon={{
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 6,
                  fillColor: "#3B82F6",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                  rotation: currentDriverLocation.heading || 0,
                }}
                zIndex={20}
                animation={google.maps.Animation.DROP}
              />
            )}

          {/* Driver InfoWindow (separate with position) */}
          {isLiveMode &&
            currentDriverLocation &&
            typeof currentDriverLocation.lat === "number" &&
            typeof currentDriverLocation.lng === "number" &&
            !isNaN(currentDriverLocation.lat) &&
            !isNaN(currentDriverLocation.lng) &&
            isFinite(currentDriverLocation.lat) &&
            isFinite(currentDriverLocation.lng) && (
              <InfoWindow
                position={{
                  lat: currentDriverLocation.lat,
                  lng: currentDriverLocation.lng,
                }}
              >
                <div className="p-2">
                  <h3 className="font-semibold">Driver Location</h3>
                  <p className="text-sm">
                    Speed:{" "}
                    {currentSpeed !== null
                      ? `${currentSpeed.toFixed(0)} km/h`
                      : "N/A"}
                  </p>
                  {distanceFromRoute !== null && (
                    <p className="text-sm">
                      Distance from route:{" "}
                      {(distanceFromRoute / 1000).toFixed(2)} km
                    </p>
                  )}
                </div>
              </InfoWindow>
            )}

          {/* Route Segment Markers */}
          {isLiveMode &&
            showRouteSteps &&
            routeSegments.map((segment, index) => {
              const midPoint = {
                lat: (segment.start.lat + segment.end.lat) / 2,
                lng: (segment.start.lng + segment.end.lng) / 2,
              };

              if (
                typeof midPoint.lat !== "number" ||
                typeof midPoint.lng !== "number" ||
                isNaN(midPoint.lat) ||
                isNaN(midPoint.lng) ||
                !isFinite(midPoint.lat) ||
                !isFinite(midPoint.lng)
              ) {
                return null;
              }

              return (
                <Marker
                  key={`segment-${index}`}
                  position={midPoint}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    fillColor: "#F59E0B",
                    fillOpacity: 0.8,
                    strokeColor: "#ffffff",
                    strokeWeight: 2,
                  }}
                  zIndex={5}
                />
              );
            })}

          {/* Route Segment InfoWindows (separate with position) */}
          {isLiveMode &&
            showRouteSteps &&
            routeSegments.map((segment, index) => {
              const midPoint = {
                lat: (segment.start.lat + segment.end.lat) / 2,
                lng: (segment.start.lng + segment.end.lng) / 2,
              };

              if (
                typeof midPoint.lat !== "number" ||
                typeof midPoint.lng !== "number" ||
                isNaN(midPoint.lat) ||
                isNaN(midPoint.lng) ||
                !isFinite(midPoint.lat) ||
                !isFinite(midPoint.lng)
              ) {
                return null;
              }

              return (
                <InfoWindow key={`segment-info-${index}`} position={midPoint}>
                  <div className="p-2">
                    <h3 className="font-semibold text-sm">{segment.name}</h3>
                    <p className="text-xs text-gray-600">
                      {(segment.distance / 1000).toFixed(2)} km
                    </p>
                    <p className="text-xs text-gray-600">
                      ~{segment.estimatedTime.toFixed(0)} min
                    </p>
                  </div>
                </InfoWindow>
              );
            })}

          {/* Deviation Segments (Historical Mode Only) */}
          {!isLiveMode &&
            analysis.deviationSegments
              .filter(
                (segment) =>
                  typeof segment.start.lat === "number" &&
                  typeof segment.start.lng === "number" &&
                  typeof segment.end.lat === "number" &&
                  typeof segment.end.lng === "number" &&
                  !isNaN(segment.start.lat) &&
                  !isNaN(segment.start.lng) &&
                  !isNaN(segment.end.lat) &&
                  !isNaN(segment.end.lng) &&
                  isFinite(segment.start.lat) &&
                  isFinite(segment.start.lng) &&
                  isFinite(segment.end.lat) &&
                  isFinite(segment.end.lng)
              )
              .map((segment, index) => (
                <Polyline
                  key={`deviation-${index}`}
                  path={[
                    { lat: segment.start.lat, lng: segment.start.lng },
                    { lat: segment.end.lat, lng: segment.end.lng },
                  ]}
                  options={{
                    strokeColor: "#EF4444",
                    strokeOpacity: 0.8,
                    strokeWeight: 5,
                    zIndex: 3,
                  }}
                  onClick={() => setSelectedSegment(index)}
                />
              ))}

          {/* Deviation Segment Info Windows */}
          {selectedSegment !== null &&
            analysis.deviationSegments[selectedSegment] && (
              <InfoWindow
                position={{
                  lat:
                    (analysis.deviationSegments[selectedSegment].start.lat +
                      analysis.deviationSegments[selectedSegment].end.lat) /
                    2,
                  lng:
                    (analysis.deviationSegments[selectedSegment].start.lng +
                      analysis.deviationSegments[selectedSegment].end.lng) /
                    2,
                }}
                onCloseClick={() => setSelectedSegment(null)}
              >
                <div className="p-2">
                  <h3 className="font-semibold">Route Deviation</h3>
                  <p className="text-sm">
                    Max Deviation:{" "}
                    {(
                      analysis.deviationSegments[selectedSegment].maxDeviation /
                      1000
                    ).toFixed(2)}{" "}
                    km
                  </p>
                  <p className="text-sm">
                    Duration:{" "}
                    {analysis.deviationSegments[
                      selectedSegment
                    ].duration.toFixed(1)}{" "}
                    minutes
                  </p>
                </div>
              </InfoWindow>
            )}
        </GoogleMap>
      </div>

      {/* Route Steps Panel (Live Mode) */}
      {isLiveMode && checkpoints.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Route Steps</h3>
              <button
                onClick={() => setShowRouteSteps(!showRouteSteps)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showRouteSteps ? "Hide" : "Show"} on Map
              </button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {checkpoints.map((checkpoint, index) => {
                const isReached = checkpoint.reachedAt !== null;
                const isCurrent =
                  index === checkpoints.findIndex((c) => !c.reachedAt);
                const segment = routeSegments[index - 1];

                return (
                  <div
                    key={checkpoint.id}
                    className={`p-3 rounded border ${
                      isCurrent
                        ? "bg-blue-50 border-blue-300"
                        : isReached
                        ? "bg-green-50 border-green-300"
                        : "bg-gray-50 border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isReached ? (
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        ) : isCurrent ? (
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                            <span className="text-white text-xs">→</span>
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-gray-600 text-xs">
                              {index + 1}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {checkpoint.name}
                          </p>
                          {segment && (
                            <p className="text-xs text-gray-500">
                              {(segment.distance / 1000).toFixed(2)} km • ~
                              {segment.estimatedTime.toFixed(0)} min
                            </p>
                          )}
                        </div>
                      </div>
                      {isReached && checkpoint.reachedAt && (
                        <span className="text-xs text-gray-500">
                          {new Date(checkpoint.reachedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Deviation Details */}
      {!isLiveMode && analysis.deviationSegments.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Deviation Segments</h3>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Start Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      End Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Max Deviation
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analysis.deviationSegments.map((segment, index) => (
                    <tr
                      key={index}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedSegment(index)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(segment.start.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(segment.end.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {segment.duration.toFixed(1)} minutes
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(segment.maxDeviation / 1000).toFixed(2)} km
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
