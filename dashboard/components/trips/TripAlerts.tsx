"use client";

import { useEffect, useState, useRef } from "react";
import { getToken } from "@/lib/auth";
import Card, { CardHeader, CardBody } from "@/components/common/Card";
import LoadingSpinner from "@/components/common/LoadingSpinner";

interface TripAlertsProps {
  tripId: string;
  isActive?: boolean; // If trip is active, show real-time alerts
}

interface Alert {
  tripId: string;
  driverId: string;
  alertType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  metadata?: {
    distanceFromRoute?: number;
    idleDuration?: number;
    speed?: number;
    checkpointIndex?: number;
    expectedTime?: string;
    actualTime?: string;
    lastUpdateTime?: string;
  };
  timestamp: Date;
}

export default function TripAlerts({
  tripId,
  isActive = false,
}: TripAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch historical alerts (if trip is completed)
  useEffect(() => {
    if (!isActive) {
      // For completed trips, fetch from API
      // Note: This would require an API endpoint to fetch stored alerts
      // For now, we'll just set loading to false
      setLoading(false);
    }
  }, [tripId, isActive]);

  // Initialize WebSocket for real-time alerts (if trip is active)
  useEffect(() => {
    if (!isActive || !tripId) return;

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
      console.log("✅ [Trip Alerts] WebSocket connected");
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
      console.log("🔌 [Trip Alerts] WebSocket disconnected");
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("❌ [Trip Alerts] WebSocket error:", error);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "tripAlert" && data.tripId === tripId) {
          const alert: Alert = {
            tripId: data.tripId,
            driverId: data.driverId,
            alertType: data.alertType,
            severity: data.severity,
            message: data.message,
            metadata: data.metadata,
            timestamp: new Date(data.timestamp),
          };

          setAlerts((prev) => [alert, ...prev]);
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
  }, [tripId, isActive]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-100 text-red-800 border-red-300";
      case "HIGH":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "LOW":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ROUTE_DEVIATION: "Route Deviation",
      LONG_IDLE_TIME: "Long Idle Time",
      SPEED_VIOLATION: "Speed Violation",
      CHECKPOINT_DELAY: "Checkpoint Delay",
      LOCATION_UPDATE_FAILURE: "Location Update Failure",
    };
    return labels[type] || type;
  };

  const filteredAlerts = alerts.filter(
    (alert) => filterType === "all" || alert.alertType === filterType
  );

  const alertTypes = Array.from(new Set(alerts.map((a) => a.alertType)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading alerts..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Trip Alerts</h2>
          <p className="text-sm text-gray-500">
            {isActive ? "Real-time alerts" : "Historical alerts"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
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
          )}
        </div>
      </div>

      {/* Filters */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Types</option>
            {alertTypes.map((type) => (
              <option key={type} value={type}>
                {getAlertTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <p className="text-gray-500">
                {alerts.length === 0
                  ? "No alerts for this trip"
                  : "No alerts match the selected filter"}
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert, index) => (
            <Card key={index}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold border ${getSeverityColor(
                          alert.severity
                        )}`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        {getAlertTypeLabel(alert.alertType)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mb-2">
                      {alert.message}
                    </p>
                    <div className="text-xs text-gray-500">
                      {alert.timestamp.toLocaleString()}
                    </div>
                    {alert.metadata && (
                      <div className="mt-2 text-xs text-gray-600 space-y-1">
                        {alert.metadata.distanceFromRoute !== undefined && (
                          <div>
                            Distance from route:{" "}
                            {(alert.metadata.distanceFromRoute / 1000).toFixed(
                              2
                            )}{" "}
                            km
                          </div>
                        )}
                        {alert.metadata.idleDuration !== undefined && (
                          <div>
                            Idle duration:{" "}
                            {alert.metadata.idleDuration.toFixed(1)} minutes
                          </div>
                        )}
                        {alert.metadata.speed !== undefined && (
                          <div>
                            Speed: {alert.metadata.speed.toFixed(1)} km/h
                          </div>
                        )}
                        {alert.metadata.checkpointIndex !== undefined && (
                          <div>
                            Checkpoint: {alert.metadata.checkpointIndex + 1}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
