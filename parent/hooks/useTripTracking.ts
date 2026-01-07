import { useEffect, useState, useRef } from "react";
import { Platform } from "react-native";
import { getParentData } from "@/lib/auth";

// Get WebSocket URL - use same host as API server for consistency
const getWebSocketUrl = (): string => {
  if (process.env.EXPO_PUBLIC_WEBSOCKET_URL) {
    // Ensure it has proper ws:// or wss:// scheme
    let url = process.env.EXPO_PUBLIC_WEBSOCKET_URL.trim();
    // Remove any leading slashes
    url = url.replace(/^\/+/, '');
    // Add ws:// if no scheme is present
    if (!url.match(/^wss?:\/\//)) {
      url = `ws://${url}`;
    }
    return url;
  }
  
  // Extract host from API URL to ensure consistency
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 
    (Platform.OS === "android" ? "http://192.168.1.105:8000/api/v1" : "http://localhost:8000/api/v1");
  
  try {
    const apiUrlObj = new URL(apiUrl);
    const host = apiUrlObj.hostname;
    
    // Use same host as API server, but port 8080 for WebSocket
    if (host === "localhost" || host === "127.0.0.1") {
      return "ws://localhost:8080";
    } else if (host === "10.0.2.2") {
      // Android emulator - use 10.0.2.2 for WebSocket too
      return "ws://10.0.2.2:8080";
    } else {
      // Physical device - use the same IP as API server
      return `ws://${host}:8080`;
    }
  } catch (e) {
    // Fallback if URL parsing fails
    if (Platform.OS === "android") {
      return "ws://192.168.1.105:8080";
    }
    return "ws://localhost:8080";
  }
};

const WEBSOCKET_URL = getWebSocketUrl();

interface TripLocationUpdate {
  type: "tripLocationUpdate";
  tripId: string;
  studentId: string;
  driverId: string;
  location: {
    latitude: number;
    longitude: number;
    heading?: number;
  };
  speed: number;
  deviationStatus: {
    isDeviated: boolean;
    distance: number;
  };
  eta?: {
    minutes: number;
    distanceMeters: number;
    method: string;
  };
  timestamp: string;
}

interface UseTripTrackingOptions {
  tripId: string;
  studentId: string;
  enabled?: boolean;
}

export const useTripTracking = ({
  tripId,
  studentId,
  enabled = true,
}: UseTripTrackingOptions) => {
  const [location, setLocation] = useState<TripLocationUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!enabled || !tripId || !studentId) {
      return;
    }

    const connect = async () => {
      try {
        const parent = await getParentData();
        if (!parent) {
          setError("Parent data not found");
          return;
        }

        // Ensure WebSocket URL is properly formatted
        const baseUrl = WEBSOCKET_URL.replace(/\/+$/, ''); // Remove trailing slashes
        const wsUrl = `${baseUrl}?role=parent&parentId=${parent.id}`;
        
        // #region agent log
        console.log('[DEBUG] WebSocket connection attempt:', { wsUrl, baseUrl: WEBSOCKET_URL, parentId: parent.id });
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:61',message:'WebSocket connection attempt',data:{wsUrl,baseUrl:WEBSOCKET_URL,parentId:parent.id},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-connect',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[WebSocket] Connected");
          setConnected(true);
          setError(null);
          reconnectAttempts.current = 0;

          // Subscribe to trip updates
          const subscriptionMessage = {
            type: "subscribeToTrip",
            role: "parent",
            tripId,
            studentId,
            parentId: parent.id,
          };
          console.log("[WebSocket] Sending subscription:", subscriptionMessage);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:120',message:'Sending subscription message',data:subscriptionMessage,timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-subscribe',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          ws.send(JSON.stringify(subscriptionMessage));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // #region agent log
            console.log('[DEBUG] WebSocket message received:', { 
              type: data.type, 
              hasLocation: !!data.location,
              location: data.location,
              tripId: data.tripId,
              studentId: data.studentId,
              fullData: JSON.stringify(data)
            });
            fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:131',message:'WebSocket message received',data:{type:data.type,hasLocation:!!data.location,location:data.location,tripId:data.tripId,studentId:data.studentId,fullData:JSON.stringify(data)},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-message',hypothesisId:'A'})}).catch(()=>{});
            // #endregion

            if (data.type === "tripLocationUpdate") {
              // Verify tripId and studentId match before accepting update
              const updateTripId = data.tripId;
              const updateStudentId = data.studentId;
              const subscribedTripId = tripId;
              const subscribedStudentId = studentId;
              
              console.log("[WebSocket] Location update received", { 
                updateTripId,
                updateStudentId,
                subscribedTripId,
                subscribedStudentId,
                matches: updateTripId === subscribedTripId && updateStudentId === subscribedStudentId,
                hasLocation: !!data.location,
                location: data.location 
              });
              
              // Only accept updates that match our subscription
              if (updateTripId === subscribedTripId && updateStudentId === subscribedStudentId) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:145',message:'Location update accepted',data:{tripId:updateTripId,studentId:updateStudentId,hasLocation:!!data.location,location:data.location,fullUpdate:JSON.stringify(data)},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-location',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                setLocation(data as TripLocationUpdate);
              } else {
                console.warn("[WebSocket] Location update ignored - tripId/studentId mismatch", {
                  updateTripId,
                  updateStudentId,
                  subscribedTripId,
                  subscribedStudentId
                });
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:160',message:'Location update rejected - ID mismatch',data:{updateTripId,updateStudentId,subscribedTripId,subscribedStudentId},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-mismatch',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
              }
            } else if (data.type === "tripSubscriptionConfirmed") {
              console.log("[WebSocket] Subscribed to trip updates", { 
                confirmedTripId: data.tripId, 
                confirmedStudentId: data.studentId,
                subscribedTripId: tripId,
                subscribedStudentId: studentId,
                matches: data.tripId === tripId && data.studentId === studentId
              });
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:137',message:'Subscription confirmed',data:{confirmedTripId:data.tripId,confirmedStudentId:data.studentId,subscribedTripId:tripId,subscribedStudentId:studentId,matches:data.tripId===tripId&&data.studentId===studentId},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-subscription',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
            } else {
              // #region agent log
              console.log('[DEBUG] WebSocket received unknown message type:', data.type);
              fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:151',message:'Unknown message type',data:{type:data.type,fullData:JSON.stringify(data)},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-unknown',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
            }
          } catch (err) {
            console.error("[WebSocket] Error parsing message:", err);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:156',message:'Error parsing WebSocket message',data:{error:err?.message,rawData:event.data},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-parse-error',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
          }
        };

        ws.onerror = (err) => {
          // #region agent log
          console.error("[WebSocket] Error:", err);
          const errorMessage = err.message || "WebSocket connection error";
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:97',message:'WebSocket error',data:{error:errorMessage,wsUrl,err:JSON.stringify(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-error',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          setError(errorMessage);
          setConnected(false);
        };

        ws.onclose = () => {
          console.log("[WebSocket] Disconnected");
          setConnected(false);

          // Attempt to reconnect
          if (reconnectAttempts.current < 5) {
            reconnectAttempts.current += 1;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          } else {
            setError("Failed to reconnect. Please refresh.");
          }
        };

        wsRef.current = ws;
      } catch (err) {
        console.error("[WebSocket] Connection error:", err);
        setError("Failed to connect to WebSocket server");
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [tripId, studentId, enabled]);

  const unsubscribe = () => {
    if (wsRef.current && connected) {
      wsRef.current.send(
        JSON.stringify({
          type: "unsubscribeFromTrip",
          role: "parent",
          tripId,
        })
      );
    }
  };

  return {
    location,
    connected,
    error,
    unsubscribe,
  };
};







