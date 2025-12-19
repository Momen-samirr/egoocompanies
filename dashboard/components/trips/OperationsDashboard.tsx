"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const getSeverityVariant = (severity: string): "default" | "destructive" | "secondary" => {
    switch (severity) {
      case "HIGH":
        return "destructive";
      case "MEDIUM":
        return "secondary";
      case "LOW":
        return "secondary";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Operations Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of active trips
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex items-center gap-2",
              isConnected ? "text-green-600" : "text-red-600"
            )}
          >
            <Circle
              className={cn(
                "h-3 w-3 fill-current",
                isConnected && "animate-pulse"
              )}
            />
            <span className="text-sm">
              {isConnected ? "Live" : "Disconnected"}
            </span>
          </div>
          <Select value={filter} onValueChange={(value) => setFilter(value as "all" | "delayed" | "on-time")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter trips" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trips</SelectItem>
              <SelectItem value="delayed">Delayed Only</SelectItem>
              <SelectItem value="on-time">On-Time Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Trips</p>
                <p className="text-2xl font-bold text-foreground">
                  {activeTrips.length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Delayed Trips</p>
                <p className="text-2xl font-bold text-destructive">
                  {delayedTrips.length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On-Time Trips</p>
                <p className="text-2xl font-bold text-green-600">
                  {activeTrips.length - delayedTrips.length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On-Time Rate</p>
                <p className="text-2xl font-bold text-foreground">
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
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delayed Trips Alert Banner */}
      {delayedTrips.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Delayed Trips ({delayedTrips.length})</AlertTitle>
          <AlertDescription>
            <div className="space-y-2 mt-2">
              {delayedTrips.map((delay) => (
                <div
                  key={delay.tripId}
                  className="flex items-center justify-between p-3 bg-background rounded border border-destructive/20"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={getSeverityVariant(delay.severity)}
                        className="text-xs"
                      >
                        {delay.severity}
                      </Badge>
                      <span className="font-semibold text-foreground">
                        {delay.tripName}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Checkpoint: {delay.checkpointName} - Expected delay:{" "}
                      {delay.delayMinutes} minutes
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expected: {delay.expectedTime.toLocaleTimeString()} | ETA:{" "}
                      {delay.estimatedArrival.toLocaleTimeString()}
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      router.push(`/dashboard/trips/${delay.tripId}`)
                    }
                    variant="destructive"
                    size="sm"
                    className="ml-4"
                  >
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Active Trips List */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Active Trips ({filteredTrips.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrips.map((trip) => {
            const delay = getDelayInfo(trip.id);
            return (
              <Card
                key={trip.id}
                className={cn(
                  "cursor-pointer hover:shadow-md transition-shadow",
                  delay && "border-destructive"
                )}
                onClick={() => router.push(`/dashboard/trips/${trip.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-foreground">{trip.name}</h3>
                    {delay && (
                      <Badge
                        variant={getSeverityVariant(delay.severity)}
                        className="text-xs"
                      >
                        {delay.delayMinutes}m late
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Captain: </span>
                      <span className="text-foreground">
                        {trip.assignedCaptain?.name || "Unassigned"}
                      </span>
                    </div>

                    {trip.nextCheckpoint && (
                      <div>
                        <span className="text-muted-foreground">Next: </span>
                        <span className="text-foreground">
                          {trip.nextCheckpoint.name}
                        </span>
                      </div>
                    )}

                    {trip.eta?.minutes && (
                      <div>
                        <span className="text-muted-foreground">ETA: </span>
                        <span className="text-foreground font-semibold">
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
                        <span className="text-muted-foreground">Speed: </span>
                        <span className="text-foreground">
                          {trip.currentLocation.speed.toFixed(1)} km/h
                        </span>
                      </div>
                    )}

                    {trip.progress?.lastLocationUpdate && (
                      <div className="text-xs text-muted-foreground">
                        Last update:{" "}
                        {new Date(
                          trip.progress.lastLocationUpdate
                        ).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredTrips.length === 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No trips match the selected filter
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
