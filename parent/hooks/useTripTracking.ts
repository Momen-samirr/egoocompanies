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
    
    // Check if URL already has a scheme
    const hasWss = url.match(/^wss:\/\//i);
    const hasWs = url.match(/^ws:\/\//i);
    
    if (hasWss || hasWs) {
      // URL already has scheme - preserve it
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:14',message:'WebSocket URL already has scheme - preserving',data:{originalUrl:process.env.EXPO_PUBLIC_WEBSOCKET_URL?.replace(/wss?:\/\//, '***://'),finalUrl:url.replace(/wss?:\/\//, '***://'),hasWss:!!hasWss,hasWs:!!hasWs},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-url-preserve',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
    } else {
      // No scheme present - determine based on API URL
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
      // If API URL uses https, use wss:// for WebSocket
      if (apiUrl.startsWith('https://')) {
        url = `wss://${url}`;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:22',message:'Added wss:// scheme based on https API URL',data:{originalUrl:process.env.EXPO_PUBLIC_WEBSOCKET_URL?.replace(/wss?:\/\//, '***://'),finalUrl:url.replace(/wss?:\/\//, '***://'),apiUrl:apiUrl.replace(/https?:\/\//, '***://')},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-url-add-wss',hypothesisId:'O'})}).catch(()=>{});
        // #endregion
      } else {
        url = `ws://${url}`;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:27',message:'Added ws:// scheme based on http API URL',data:{originalUrl:process.env.EXPO_PUBLIC_WEBSOCKET_URL?.replace(/wss?:\/\//, '***://'),finalUrl:url.replace(/wss?:\/\//, '***://'),apiUrl:apiUrl.replace(/https?:\/\//, '***://')},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-url-add-ws',hypothesisId:'P'})}).catch(()=>{});
        // #endregion
      }
    }
    
    console.log('[WebSocket] Using WebSocket URL:', url.replace(/wss?:\/\//, '***://'));
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:6',message:'WebSocket URL determined',data:{envUrl:process.env.EXPO_PUBLIC_WEBSOCKET_URL,finalUrl:url.replace(/wss?:\/\//, '***://'),apiUrl:process.env.EXPO_PUBLIC_API_URL?.replace(/https?:\/\//, '***://'),platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-url-config',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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

// Log environment configuration on module load (for debugging production issues)
if (typeof window !== 'undefined' || typeof global !== 'undefined') {
  const envCheck = {
    hasExpoPublicWebSocketUrl: !!process.env.EXPO_PUBLIC_WEBSOCKET_URL,
    hasExpoPublicApiUrl: !!process.env.EXPO_PUBLIC_API_URL,
    expoPublicWebSocketUrl: process.env.EXPO_PUBLIC_WEBSOCKET_URL?.replace(/wss?:\/\//, '***://'),
    expoPublicApiUrl: process.env.EXPO_PUBLIC_API_URL?.replace(/https?:\/\//, '***://'),
    finalWebSocketUrl: WEBSOCKET_URL.replace(/wss?:\/\//, '***://'),
    isProduction: process.env.EXPO_PUBLIC_API_URL?.includes('egoobus.com') || false,
  };
  console.log('[useTripTracking] Environment check:', envCheck);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:46',message:'Environment variables check on module load',data:envCheck,timestamp:Date.now(),sessionId:'debug-session',runId:'env-check-module-load',hypothesisId:'M'})}).catch(()=>{});
  // #endregion
}

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
  const locationRef = useRef<TripLocationUpdate | null>(null); // Ref to track current location for comparison
  const isCleaningUpRef = useRef(false); // Flag to prevent reconnection during cleanup
  const isConnectingRef = useRef(false); // Flag to prevent multiple simultaneous connection attempts

  useEffect(() => {
    // #region agent log
    console.log('[CRITICAL] useTripTracking useEffect RUNNING', { tripId, studentId, enabled, isCleaningUp: isCleaningUpRef.current, isConnecting: isConnectingRef.current });
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:135',message:'useTripTracking useEffect RUNNING',data:{tripId,studentId,enabled,hasExistingWs:!!wsRef.current,wsRefReadyState:wsRef.current?.readyState,isCleaningUp:isCleaningUpRef.current,isConnecting:isConnectingRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'useTripTracking-effect-run',hypothesisId:'J'})}).catch(()=>{});
    // #endregion
    
    if (!enabled || !tripId || !studentId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:139',message:'useTripTracking useEffect - disabled or missing params',data:{enabled,tripId,studentId},timestamp:Date.now(),sessionId:'debug-session',runId:'useTripTracking-effect-skip',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      return;
    }

    const connect = async () => {
      // Prevent multiple simultaneous connection attempts
      if (isConnectingRef.current) {
        console.log('[WebSocket] Connection already in progress, skipping');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:138',message:'WebSocket connection already in progress - skipping',data:{isCleaningUp:isCleaningUpRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-connect-skip',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        return;
      }

      // Don't connect if cleanup is in progress
      if (isCleaningUpRef.current) {
        console.log('[WebSocket] Cleanup in progress, skipping connection');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:145',message:'WebSocket connection skipped - cleanup in progress',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-connect-skip-cleanup',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        return;
      }

      // Close existing connection if any
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] Closing existing connection before creating new one');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:152',message:'Closing existing WebSocket connection',data:{readyState:wsRef.current.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-close-existing',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        try {
          wsRef.current.close(1000, 'Creating new connection');
        } catch (e) {
          console.error('[WebSocket] Error closing existing connection:', e);
        }
      }

      isConnectingRef.current = true;

      try {
        const parent = await getParentData();
        if (!parent) {
          setError("Parent data not found");
          isConnectingRef.current = false;
          return;
        }

        // Ensure WebSocket URL is properly formatted
        const baseUrl = WEBSOCKET_URL.replace(/\/+$/, ''); // Remove trailing slashes
        const wsUrl = `${baseUrl}?role=parent&parentId=${parent.id}`;
        
        // #region agent log
        console.log('[DEBUG] WebSocket connection attempt:', { wsUrl, baseUrl: WEBSOCKET_URL, parentId: parent.id });
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:158',message:'WebSocket connection attempt',data:{wsUrl,baseUrl:WEBSOCKET_URL,parentId:parent.id,hasExistingWs:!!wsRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-connect',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        const ws = new WebSocket(wsUrl);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:155',message:'WebSocket instance created - setting handlers',data:{wsUrl:wsUrl.replace(/wss?:\/\//, '***://'),readyState:ws.readyState,parentId:parent.id},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-create',hypothesisId:'H'})}).catch(()=>{});
        // #endregion

        ws.onopen = () => {
          console.log("[WebSocket] Connected successfully to:", wsUrl.replace(/wss?:\/\//, '***://'));
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:177',message:'WebSocket onopen fired',data:{wsUrl:wsUrl.replace(/wss?:\/\//, '***://'),readyState:ws.readyState,parentId:parent.id,isCleaningUp:isCleaningUpRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-onopen',hypothesisId:'H'})}).catch(()=>{});
          // #endregion
          isConnectingRef.current = false; // Connection established
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
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:173',message:'WebSocket connected and sending subscription',data:{wsUrl:wsUrl.replace(/wss?:\/\//, '***://'),subscriptionMessage,parentId:parent.id,readyState:ws.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-subscribe',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          try {
            ws.send(JSON.stringify(subscriptionMessage));
            console.log("[WebSocket] Subscription message sent successfully");
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:177',message:'Subscription message sent via WebSocket',data:{readyState:ws.readyState,subscriptionMessage},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-subscribe-sent',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
          } catch (sendError) {
            console.error("[WebSocket] Error sending subscription:", sendError);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:179',message:'Error sending subscription',data:{error:sendError?.message,subscriptionMessage,readyState:ws.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-subscribe-error',hypothesisId:'G'})}).catch(()=>{});
            // #endregion
          }
        };

        ws.onmessage = (event) => {
          // #region agent log
          // CRITICAL: Log IMMEDIATELY when onmessage fires, before any parsing
          const onmessageState = {
            hasData: !!event.data,
            dataType: typeof event.data,
            dataLength: event.data?.length,
            readyState: ws.readyState,
            url: ws.url?.replace(/wss?:\/\//, '***://'),
            protocol: ws.protocol,
            extensions: ws.extensions,
            bufferedAmount: ws.bufferedAmount,
            isCleaningUp: isCleaningUpRef.current,
            hasWsRef: wsRef.current === ws,
            wsRefReadyState: wsRef.current?.readyState,
            timestamp: new Date().toISOString()
          };
          console.log('[CRITICAL] WebSocket onmessage FIRED - raw event received', onmessageState);
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:241',message:'WebSocket onmessage handler FIRED',data:{...onmessageState,dataPreview:typeof event.data==='string'?event.data.substring(0,200):String(event.data).substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-onmessage-fired',hypothesisId:'H'})}).catch(()=>{});
          // #endregion
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
                // Use ref to get current location value (not stale closure value)
                const prevLocationState = locationRef.current;
                const prevLocationCoords = prevLocationState?.location;
                const newLocationCoords = data.location;
                // Reduced threshold from 0.0001 (11m) to 0.00001 (1.1m) to detect smaller movements
                const coordsChanged = !prevLocationCoords || 
                  Math.abs(prevLocationCoords.latitude - newLocationCoords.latitude) > 0.00001 ||
                  Math.abs(prevLocationCoords.longitude - newLocationCoords.longitude) > 0.00001;
                const locationUpdateData = {
                  tripId: updateTripId,
                  studentId: updateStudentId,
                  driverId: data.driverId,
                  hasLocation: !!data.location,
                  location: data.location,
                  speed: data.speed,
                  deviationStatus: data.deviationStatus,
                  eta: data.eta,
                  timestamp: data.timestamp,
                  isProduction: process.env.EXPO_PUBLIC_API_URL?.includes('egoobus.com') || false,
                  websocketUrl: WEBSOCKET_URL.replace(/wss?:\/\//, '***://'),
                  apiUrl: process.env.EXPO_PUBLIC_API_URL?.replace(/https?:\/\//, '***://'),
                  prevLocationLat: prevLocationCoords?.latitude,
                  prevLocationLng: prevLocationCoords?.longitude,
                  newLocationLat: newLocationCoords?.latitude,
                  newLocationLng: newLocationCoords?.longitude,
                  coordsChanged,
                };
                console.log('[WebSocket] ✅ Location update accepted and setting state:', {
                  hasLocation: !!data.location,
                  location: data.location,
                  driverId: data.driverId,
                  isProduction: locationUpdateData.isProduction,
                  coordsChanged
                });
                fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:224',message:'Location update accepted - setting state',data:locationUpdateData,timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-location-accepted',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                
                // Create a new object to ensure reference change triggers re-render
                // Always create new object to ensure React detects the change
                const newLocationUpdate: TripLocationUpdate = {
                  type: data.type,
                  tripId: data.tripId,
                  studentId: data.studentId,
                  driverId: data.driverId,
                  location: {
                    latitude: data.location.latitude,
                    longitude: data.location.longitude,
                    heading: data.location.heading,
                  },
                  speed: data.speed,
                  deviationStatus: data.deviationStatus,
                  eta: data.eta,
                  timestamp: data.timestamp,
                };
                
                // Use functional setState to ensure we're updating based on latest state
                setLocation((prevLocation) => {
                  // Even if coordinates haven't changed significantly, update to ensure re-render
                  return newLocationUpdate;
                });
                
                // #region agent log
                // Log after state update attempt
                setTimeout(() => {
                  fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:258',message:'Location state update attempted',data:{tripId:updateTripId,studentId:updateStudentId,hasLocation:!!data.location,location:data.location,newLocationUpdate,coordsChanged},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-location-state-set',hypothesisId:'C'})}).catch(()=>{});
                }, 100);
                // #endregion
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
              const confirmationData = {
                confirmedTripId: data.tripId, 
                confirmedStudentId: data.studentId,
                subscribedTripId: tripId,
                subscribedStudentId: studentId,
                matches: data.tripId === tripId && data.studentId === studentId,
                message: data.message,
                hasLocation: !!location,
                location: location,
                connected,
                readyState: ws.readyState,
                url: ws.url?.replace(/wss?:\/\//, '***://'),
                isCleaningUp: isCleaningUpRef.current
              };
              console.log("[WebSocket] ✅ Subscription confirmed!", confirmationData);
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:365',message:'Subscription confirmed',data:confirmationData,timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-subscription-confirmed',hypothesisId:'B'})}).catch(()=>{});
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
          console.error("[WebSocket] ❌ Connection error:", err);
          const errorMessage = err.message || "WebSocket connection error";
          const errorDetails = {
            error: errorMessage,
            wsUrl: wsUrl.replace(/wss?:\/\//, '***://'),
            readyState: ws.readyState,
            url: ws.url?.replace(/wss?:\/\//, '***://'),
            protocol: ws.protocol,
            extensions: ws.extensions
          };
          console.error("[WebSocket] Error details:", errorDetails);
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:209',message:'WebSocket error',data:errorDetails,timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-error',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          setError(errorMessage);
          setConnected(false);
        };

        ws.onclose = (event) => {
          console.log("[WebSocket] Disconnected", { 
            code: event.code, 
            reason: event.reason || 'No reason provided',
            wasClean: event.wasClean,
            isCleaningUp: isCleaningUpRef.current
          });
          setConnected(false);
          isConnectingRef.current = false; // Connection closed

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:365',message:'WebSocket disconnected',data:{code:event.code,reason:event.reason,wasClean:event.wasClean,reconnectAttempts:reconnectAttempts.current,isCleaningUp:isCleaningUpRef.current,wsUrl:wsUrl.replace(/wss?:\/\//, '***://')},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-disconnect',hypothesisId:'H'})}).catch(()=>{});
          // #endregion

          // Don't reconnect if cleanup is in progress (intentional close)
          if (isCleaningUpRef.current) {
            console.log('[WebSocket] Cleanup in progress - not reconnecting');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:368',message:'WebSocket disconnect during cleanup - reconnection prevented',data:{code:event.code,reason:event.reason},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-disconnect-cleanup',hypothesisId:'I'})}).catch(()=>{});
            // #endregion
            return;
          }

          // Attempt to reconnect only if not cleaning up
          if (reconnectAttempts.current < 5) {
            reconnectAttempts.current += 1;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/5)`);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isCleaningUpRef.current) {
                connect();
              }
            }, delay);
          } else {
            console.error("[WebSocket] Max reconnection attempts reached");
            setError("Failed to reconnect. Please refresh.");
          }
        };

        wsRef.current = ws;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:407',message:'WebSocket ref set and handlers attached',data:{hasWsRef:!!wsRef.current,wsRefReadyState:wsRef.current?.readyState,wsReadyState:ws.readyState,parentId:parent.id},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-ref-set',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
      } catch (err) {
        isConnectingRef.current = false; // Reset on error
        console.error("[WebSocket] Connection error:", err);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:410',message:'WebSocket connection error in connect function',data:{error:err?.message,errorStack:err?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-connect-error',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        setError("Failed to connect to WebSocket server");
      }
    };

    connect();

    return () => {
      // #region agent log
      console.log('[CRITICAL] useTripTracking cleanup function CALLED', { tripId, studentId, enabled, hasWsRef: !!wsRef.current });
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:456',message:'useTripTracking cleanup function CALLED',data:{tripId,studentId,enabled,hasWsRef:!!wsRef.current,wsRefReadyState:wsRef.current?.readyState,isCleaningUpBefore:isCleaningUpRef.current,isConnectingBefore:isConnectingRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'useTripTracking-cleanup-called',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      
      // Set cleanup flag to prevent reconnection
      isCleaningUpRef.current = true;
      
      // Clear any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:464',message:'Cleared reconnect timeout during cleanup',data:{tripId,studentId},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-cleanup-clear-timeout',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
      }
      
      // Unsubscribe before closing
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({
            type: "unsubscribeFromTrip",
            role: "parent",
            tripId,
          }));
          console.log("[WebSocket] Unsubscribed from trip before closing");
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:473',message:'WebSocket unsubscribed before cleanup',data:{tripId,studentId,readyState:wsRef.current.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-unsubscribe-cleanup',hypothesisId:'I'})}).catch(()=>{});
          // #endregion
        } catch (e) {
          console.error("[WebSocket] Error unsubscribing:", e);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:477',message:'Error unsubscribing during cleanup',data:{tripId,studentId,error:e?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-unsubscribe-error',hypothesisId:'J'})}).catch(()=>{});
          // #endregion
        }
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:480',message:'WebSocket not open during cleanup - skipping unsubscribe',data:{tripId,studentId,hasWsRef:!!wsRef.current,readyState:wsRef.current?.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-cleanup-skip-unsubscribe',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
      }
      
      // Close the connection
      if (wsRef.current) {
        try {
          // Remove handlers to prevent reconnection triggers
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          wsRef.current.onopen = null;
          
          wsRef.current.close(1000, 'Component unmounting');
          console.log("[WebSocket] Connection closed during cleanup");
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:493',message:'WebSocket closed during cleanup',data:{tripId,studentId,readyState:wsRef.current?.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-cleanup-close',hypothesisId:'I'})}).catch(()=>{});
          // #endregion
        } catch (e) {
          console.error("[WebSocket] Error closing connection:", e);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:498',message:'Error closing WebSocket during cleanup',data:{tripId,studentId,error:e?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-cleanup-close-error',hypothesisId:'J'})}).catch(()=>{});
          // #endregion
        }
        wsRef.current = null;
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:504',message:'No WebSocket ref during cleanup',data:{tripId,studentId},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-cleanup-no-ref',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
      }
      
      // Reset cleanup flag after a delay (to allow close handlers to check it)
      setTimeout(() => {
        isCleaningUpRef.current = false;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:510',message:'Cleanup flag reset after delay',data:{tripId,studentId},timestamp:Date.now(),sessionId:'debug-session',runId:'websocket-cleanup-flag-reset',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
      }, 1000);
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

  // Update ref whenever location state changes (for use in closures)
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // Log location state changes
  useEffect(() => {
    // #region agent log
    const locationStateData = {
      hasLocation: !!location,
      hasLocationLocation: !!location?.location,
      locationLat: location?.location?.latitude,
      locationLng: location?.location?.longitude,
      driverId: location?.driverId,
      tripId: location?.tripId,
      studentId: location?.studentId,
      connected,
      error,
      isProduction: process.env.EXPO_PUBLIC_API_URL?.includes('egoobus.com') || false,
      websocketUrl: WEBSOCKET_URL.replace(/wss?:\/\//, '***://'),
    };
    console.log('[useTripTracking] Location state:', {
      hasLocation: !!location,
      hasLocationLocation: !!location?.location,
      connected,
      error,
      isProduction: locationStateData.isProduction
    });
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTripTracking.ts:272',message:'Location state changed',data:locationStateData,timestamp:Date.now(),sessionId:'debug-session',runId:'location-state-change',hypothesisId:'I'})}).catch(()=>{});
    // #endregion
  }, [location, connected, error]);

  return {
    location,
    connected,
    error,
    unsubscribe,
  };
};







