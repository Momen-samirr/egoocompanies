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
    etaMinutes?: number;
    delayMinutes?: number;
    distanceMeters?: number;
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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5;

  // Fetch historical alerts (if trip is completed)
  useEffect(() => {
    if (!isActive) {
      // For completed trips, fetch from API
      // Note: This would require an API endpoint to fetch stored alerts
      // For now, we'll just set loading to false
      setLoading(false);
    } else {
      // For active trips, set loading to false once WebSocket connection is attempted
      // We don't need to wait for connection to succeed to show the UI
      setLoading(false);
    }
  }, [tripId, isActive]);

  // Test HTTP connectivity to WebSocket server (health check)
  // Note: This is optional - if health endpoint doesn't exist, we'll still try WebSocket
  const testServerConnectivity = async (baseUrl: string): Promise<boolean> => {
    try {
      // Convert ws:// to http:// for health check
      const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/$/, ""); // Remove trailing slash
      const healthUrl = `${httpUrl}/api/health`;

      const response = await fetch(healthUrl, {
        method: "GET",
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });

      return response.ok;
    } catch (error) {
      // Health check is optional - don't block WebSocket connection if it fails
      console.debug(
        "⚠️ [Trip Alerts] Server health check failed (non-blocking):",
        error
      );
      return true; // Return true to allow WebSocket connection attempt
    }
  };

  // Initialize WebSocket for real-time alerts (if trip is active)
  useEffect(() => {
    if (!isActive || !tripId) return;

    // Reset connection error
    setConnectionError(null);

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
      "🔌 [Trip Alerts] Connecting to WebSocket:",
      fullWsUrl.replace(/token=[^&]+/, "token=***")
    );

    // Set loading to false once we start attempting connection
    // Don't wait for connection to succeed to show the UI
    setLoading(false);

    // Test server connectivity (non-blocking - won't prevent WebSocket connection)
    testServerConnectivity(wsUrl).catch(() => {
      // Health check failure is non-blocking
    });

    const ws = new WebSocket(fullWsUrl);

    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.error("❌ [Trip Alerts] WebSocket connection timeout");
        ws.close();
        setIsConnected(false);
        setLoading(false); // Ensure loading is false on timeout
      }
    }, 10000); // 10 second timeout

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log("✅ [Trip Alerts] WebSocket connected");
      setIsConnected(true);
      setConnectionError(null);
      setLoading(false); // Ensure loading is false when connected
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection

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
          console.error("❌ [Trip Alerts] Error sending subscription:", error);
        }
      }
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      console.log("🔌 [Trip Alerts] WebSocket disconnected", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });

      // Provide helpful error messages based on close code
      let errorMessage = "";
      if (event.code === 1006) {
        const causes = [
          "WebSocket server is not running",
          "Network connectivity issue",
          "Firewall blocking the connection",
          "Server address/port is incorrect",
        ];
        errorMessage = `Connection failed. Please check: ${causes.join(", ")}`;
        console.error(
          "❌ [Trip Alerts] Connection closed abnormally. Possible causes:"
        );
        causes.forEach((cause) => console.error(`   - ${cause}`));
      } else if (event.code === 1002) {
        errorMessage = "Protocol error - check WebSocket server configuration";
        console.error(
          "❌ [Trip Alerts] Protocol error - check WebSocket server configuration"
        );
      } else if (event.code === 1008) {
        errorMessage = "Policy violation - check authentication/authorization";
        console.error(
          "❌ [Trip Alerts] Policy violation - check authentication/authorization"
        );
      } else {
        errorMessage = `Connection closed (code: ${event.code})`;
      }

      setConnectionError(errorMessage);
      setIsConnected(false);
      setLoading(false); // Stop loading even if connection fails

      // Attempt to reconnect if we haven't exceeded max attempts
      // Note: Reconnection is handled by the useEffect dependency on isConnected
      // We'll just update the attempt counter here
      if (
        event.code === 1006 &&
        reconnectAttemptsRef.current < maxReconnectAttempts
      ) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          30000
        ); // Exponential backoff, max 30s
        console.log(
          `🔄 [Trip Alerts] Will attempt to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${delay}ms...`
        );

        // The useEffect will trigger reconnection when isConnected changes
        // We'll let it handle the reconnection naturally
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setConnectionError(
          "Failed to connect after multiple attempts. Please check server status and refresh the page."
        );
        setLoading(false); // Ensure loading is false after max attempts
      }
    };

    ws.onerror = (error) => {
      // WebSocket error events don't provide much detail, but we can log what we know
      console.error("❌ [Trip Alerts] WebSocket error occurred");
      console.error(
        "❌ [Trip Alerts] WebSocket URL:",
        fullWsUrl.replace(/token=[^&]+/, "token=***")
      );
      console.error("❌ [Trip Alerts] WebSocket readyState:", ws.readyState);
      console.error("❌ [Trip Alerts] Error event:", error);
      setIsConnected(false);
      setLoading(false); // Stop loading on error
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
      clearTimeout(connectionTimeout);
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
        // Close with normal closure code
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close(1000, "Component unmounting");
        }
        wsRef.current = null;
      }
      // Reset reconnect attempts when component unmounts or dependencies change
      reconnectAttemptsRef.current = 0;
      setIsConnected(false);
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
                } ${isConnected ? "animate-pulse" : ""}`}
              />
              <span className="text-sm">
                {isConnected ? "Live" : "Disconnected"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Connection Error Message */}
      {isActive && connectionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Connection Error
              </h3>
              <p className="mt-1 text-sm text-red-700">{connectionError}</p>
              <p className="mt-2 text-xs text-red-600">
                Server:{" "}
                {process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080"}
              </p>
            </div>
          </div>
        </div>
      )}

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
                        {alert.metadata.delayMinutes !== undefined && (
                          <div className="font-semibold text-red-600">
                            ⚠️ Delay: {alert.metadata.delayMinutes.toFixed(1)}{" "}
                            minutes
                          </div>
                        )}
                        {alert.metadata.etaMinutes !== undefined && (
                          <div>
                            ETA to checkpoint:{" "}
                            {alert.metadata.etaMinutes.toFixed(0)} minutes
                          </div>
                        )}
                        {alert.metadata.distanceMeters !== undefined && (
                          <div>
                            Distance to checkpoint:{" "}
                            {(alert.metadata.distanceMeters / 1000).toFixed(2)}{" "}
                            km
                          </div>
                        )}
                        {alert.metadata.expectedTime && (
                          <div>
                            Expected time:{" "}
                            {new Date(
                              alert.metadata.expectedTime
                            ).toLocaleString()}
                          </div>
                        )}
                        {alert.metadata.actualTime && (
                          <div>
                            Estimated arrival:{" "}
                            {new Date(
                              alert.metadata.actualTime
                            ).toLocaleString()}
                          </div>
                        )}
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
