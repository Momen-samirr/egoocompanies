"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getToken } from "@/lib/auth";
import Card, { CardHeader, CardBody } from "@/components/common/Card";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

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
    speed?: number;
    etaToNextCheckpoint?: number;
    etaMethod?: string;
    distanceFromNextCheckpoint?: number;
  };
  nextCheckpoint?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    expectedTime?: string;
  };
  progress?: {
    currentPointIndex: number;
    startedAt?: string;
    lastLocationUpdate?: string;
  };
  eta?: {
    minutes?: number;
    method?: string;
    calculatedAt?: string;
    distanceMeters?: number;
  };
}

interface TripDelay {
  tripId: string;
  tripName: string;
  checkpointName: string;
  checkpointIndex: number;
  delayMinutes: number;
  expectedTime: Date;
  estimatedArrival: Date;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export default function OperationsDashboard() {
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [delayedTrips, setDelayedTrips] = useState<TripDelay[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [filter, setFilter] = useState<"all" | "delayed" | "on-time">("all");
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch active trips
  const fetchActiveTrips = async () => {
    try {
      const response = await api.get("/admin/trips/active/live");
      if (response.data.success) {
        setActiveTrips(response.data.trips);
        calculateDelays(response.data.trips);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching active trips:", error);
      setLoading(false);
    }
  };

  // Calculate delays for trips
  const calculateDelays = (trips: ActiveTrip[]) => {
    const delays: TripDelay[] = [];

    trips.forEach((trip) => {
      if (
        trip.nextCheckpoint?.expectedTime &&
        trip.eta?.minutes !== undefined &&
        trip.eta.minutes > 0
      ) {
        const expectedTime = new Date(trip.nextCheckpoint.expectedTime);
        const now = new Date();
        const estimatedArrival = new Date(
          now.getTime() + trip.eta.minutes * 60 * 1000
        );
        const delayMinutes =
          (estimatedArrival.getTime() - expectedTime.getTime()) / (60 * 1000);

        if (delayMinutes > 5) {
          // 5 minute threshold
          const severity =
            delayMinutes > 30 ? "HIGH" : delayMinutes > 20 ? "MEDIUM" : "LOW";

          delays.push({
            tripId: trip.id,
            tripName: trip.name,
            checkpointName: trip.nextCheckpoint.name,
            checkpointIndex: trip.progress?.currentPointIndex || 0,
            delayMinutes: Math.round(delayMinutes),
            expectedTime,
            estimatedArrival,
            severity,
          });
        }
      }
    });

    setDelayedTrips(delays);
  };

  // Initial fetch
  useEffect(() => {
    fetchActiveTrips();
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    let wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080";
    wsUrl = wsUrl.trim();
    if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
      wsUrl = `ws://${wsUrl}`;
    }
    wsUrl = wsUrl.replace(/\/+$/, "");

    const token = getToken();
    const params = new URLSearchParams({ role: "admin" });
    if (token) {
      params.append("token", token);
    }
    const fullWsUrl = `${wsUrl}?${params.toString()}`;

    const ws = new WebSocket(fullWsUrl);

    ws.onopen = () => {
      console.log("✅ [Operations Dashboard] WebSocket connected");
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log("🔌 [Operations Dashboard] WebSocket disconnected");
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("❌ [Operations Dashboard] WebSocket error:", error);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "tripLocationUpdate") {
          // Update trip location
          setActiveTrips((prev) => {
            const updated = prev.map((trip) => {
              if (trip.id === data.tripId) {
                return {
                  ...trip,
                  currentLocation: {
                    ...trip.currentLocation,
                    ...data.location,
                    timestamp: new Date(data.timestamp),
                  },
                  eta: data.eta || trip.eta,
                };
              }
              return trip;
            });
            calculateDelays(updated);
            return updated;
          });
        } else if (
          data.type === "tripAlert" &&
          data.alertType === "CHECKPOINT_DELAY"
        ) {
          // Refresh trips when delay alert is received
          fetchActiveTrips();
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    wsRef.current = ws;

    // Poll for updates as fallback
    const pollInterval = setInterval(fetchActiveTrips, 30000); // Every 30 seconds

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      clearInterval(pollInterval);
    };
  }, []);

  const filteredTrips =
    filter === "all"
      ? activeTrips
      : filter === "delayed"
      ? activeTrips.filter((trip) =>
          delayedTrips.some((delay) => delay.tripId === trip.id)
        )
      : activeTrips.filter(
          (trip) => !delayedTrips.some((delay) => delay.tripId === trip.id)
        );

  const getDelayInfo = (tripId: string): TripDelay | undefined => {
    return delayedTrips.find((delay) => delay.tripId === tripId);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return "bg-red-100 text-red-800 border-red-300";
      case "MEDIUM":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "LOW":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading operations dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Operations Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Real-time monitoring of active trips
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
              } ${isConnected ? "animate-pulse" : ""}`}
            />
            <span className="text-sm">
              {isConnected ? "Live" : "Disconnected"}
            </span>
          </div>
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "all" | "delayed" | "on-time")
            }
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Trips</option>
            <option value="delayed">Delayed Only</option>
            <option value="on-time">On-Time Only</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Trips</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activeTrips.length}
                </p>
              </div>
              <ClockIcon className="h-8 w-8 text-blue-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Delayed Trips</p>
                <p className="text-2xl font-bold text-red-600">
                  {delayedTrips.length}
                </p>
              </div>
              <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">On-Time Trips</p>
                <p className="text-2xl font-bold text-green-600">
                  {activeTrips.length - delayedTrips.length}
                </p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">On-Time Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activeTrips.length > 0
                    ? Math.round(
                        ((activeTrips.length - delayedTrips.length) /
                          activeTrips.length) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-gray-400" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Delayed Trips Alert Banner */}
      {delayedTrips.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-900">
                Delayed Trips ({delayedTrips.length})
              </h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {delayedTrips.map((delay) => (
                <div
                  key={delay.tripId}
                  className="flex items-center justify-between p-3 bg-white rounded border border-red-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold border ${getSeverityColor(
                          delay.severity
                        )}`}
                      >
                        {delay.severity}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {delay.tripName}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Checkpoint: {delay.checkpointName} - Expected delay:{" "}
                      {delay.delayMinutes} minutes
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Expected: {delay.expectedTime.toLocaleTimeString()} | ETA:{" "}
                      {delay.estimatedArrival.toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      router.push(`/dashboard/trips/${delay.tripId}`)
                    }
                    className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Active Trips List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Active Trips ({filteredTrips.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrips.map((trip) => {
            const delay = getDelayInfo(trip.id);
            return (
              <Card
                key={trip.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  delay ? "border-red-300" : ""
                }`}
                onClick={() => router.push(`/dashboard/trips/${trip.id}`)}
              >
                <CardBody>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{trip.name}</h3>
                    {delay && (
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold border ${getSeverityColor(
                          delay.severity
                        )}`}
                      >
                        {delay.delayMinutes}m late
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Captain: </span>
                      <span className="text-gray-900">
                        {trip.assignedCaptain?.name || "Unassigned"}
                      </span>
                    </div>

                    {trip.nextCheckpoint && (
                      <div>
                        <span className="text-gray-500">Next: </span>
                        <span className="text-gray-900">
                          {trip.nextCheckpoint.name}
                        </span>
                      </div>
                    )}

                    {trip.eta?.minutes && (
                      <div>
                        <span className="text-gray-500">ETA: </span>
                        <span className="text-gray-900 font-semibold">
                          {trip.eta.minutes} min
                        </span>
                        {trip.eta.method === "google_maps" && (
                          <span className="ml-1 text-xs text-green-600">
                            (Traffic)
                          </span>
                        )}
                      </div>
                    )}

                    {trip.currentLocation?.speed && (
                      <div>
                        <span className="text-gray-500">Speed: </span>
                        <span className="text-gray-900">
                          {trip.currentLocation.speed.toFixed(1)} km/h
                        </span>
                      </div>
                    )}

                    {trip.progress?.lastLocationUpdate && (
                      <div className="text-xs text-gray-400">
                        Last update:{" "}
                        {new Date(
                          trip.progress.lastLocationUpdate
                        ).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>

        {filteredTrips.length === 0 && (
          <Card>
            <CardBody>
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No trips match the selected filter
                </p>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
