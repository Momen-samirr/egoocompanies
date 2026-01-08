import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Linking,
  Animated,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import MapDirections from "react-native-maps-directions";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";
import { useTripTracking } from "@/hooks/useTripTracking";
import Constants from "expo-constants";

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMaps?.apiKey || 
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey || 
  "AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q";

// Calculate distance between two coordinates using Haversine formula (in meters) - fallback only
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Get accurate distance and duration from Google Maps Directions API
const getDirectionsData = async (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  apiKey: string
): Promise<{ distanceMeters: number; durationMinutes: number } | null> => {
  try {
    // Validate coordinates before making API call
    if (
      !origin || !destination ||
      typeof origin.latitude !== 'number' || typeof origin.longitude !== 'number' ||
      typeof destination.latitude !== 'number' || typeof destination.longitude !== 'number' ||
      isNaN(origin.latitude) || isNaN(origin.longitude) ||
      isNaN(destination.latitude) || isNaN(destination.longitude) ||
      Math.abs(origin.latitude) > 90 || Math.abs(origin.longitude) > 180 ||
      Math.abs(destination.latitude) > 90 || Math.abs(destination.longitude) > 180
    ) {
      console.warn('[Directions API] Invalid coordinates provided');
      return null;
    }
    
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destinationStr = `${destination.latitude},${destination.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&key=${apiKey}&departure_time=now&traffic_model=best_guess`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[Directions API] HTTP error:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:45',message:'Google Maps Directions API response',data:{status:data.status,hasRoutes:!!data.routes,hasLegs:!!leg,distanceMeters:leg?.distance?.value,distanceText:leg?.distance?.text,durationSeconds:leg?.duration_in_traffic?.value||leg?.duration?.value,durationText:leg?.duration_in_traffic?.text||leg?.duration?.text,origin:originStr,destination:destinationStr},timestamp:Date.now(),sessionId:'debug-session',runId:'directions-api',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const distanceMeters = leg.distance?.value || 0;
      // Prefer duration_in_traffic if available, otherwise use duration
      const durationSeconds = leg.duration_in_traffic?.value || leg.duration?.value || 0;
      const durationMinutes = Math.round(durationSeconds / 60);
      
      return {
        distanceMeters,
        durationMinutes: Math.max(0, durationMinutes),
      };
    } else {
      console.warn('[Directions API] Error:', data.status, data.error_message);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:60',message:'Google Maps Directions API error',data:{status:data.status,errorMessage:data.error_message,origin:originStr,destination:destinationStr},timestamp:Date.now(),sessionId:'debug-session',runId:'directions-api-error',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return null;
    }
  } catch (error: any) {
    console.error('[Directions API] Request failed:', error);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:68',message:'Google Maps Directions API request failed',data:{error:error?.message,origin:`${origin.latitude},${origin.longitude}`,destination:`${destination.latitude},${destination.longitude}`},timestamp:Date.now(),sessionId:'debug-session',runId:'directions-api-failure',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return null;
  }
};

// Calculate ETA to target point using Google Maps Directions API
const calculateETAToStudentStop = async (
  driverLocation: { latitude: number; longitude: number } | null,
  targetPoint: { latitude: number; longitude: number } | null,
  apiKey: string
): Promise<{ minutes: number; distanceMeters: number } | null> => {
  if (!driverLocation || !targetPoint) return null;
  
  // Try Google Maps Directions API first for accurate results
  const directionsData = await getDirectionsData(driverLocation, targetPoint, apiKey);
  
  if (directionsData) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:85',message:'Using Google Maps Directions API result',data:{distanceMeters:directionsData.distanceMeters,distanceKm:directionsData.distanceMeters/1000,durationMinutes:directionsData.durationMinutes,driverLocation,targetPoint},timestamp:Date.now(),sessionId:'debug-session',runId:'eta-calculation',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return {
      minutes: directionsData.durationMinutes,
      distanceMeters: directionsData.distanceMeters,
    };
  }
  
  // Fallback to Haversine calculation if API fails
  const distanceMeters = calculateDistance(
    driverLocation.latitude,
    driverLocation.longitude,
    targetPoint.latitude,
    targetPoint.longitude
  );
  
  // Use average speed of 40 km/h for fallback calculation
  const speedKmh = 40;
  const speedKmPerMin = speedKmh / 60;
  const distanceKm = distanceMeters / 1000;
  const minutes = distanceKm / speedKmPerMin;
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:105',message:'Using Haversine fallback calculation',data:{distanceMeters,distanceKm,minutes,driverLocation,targetPoint},timestamp:Date.now(),sessionId:'debug-session',runId:'eta-fallback',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  return {
    minutes: Math.max(0, Math.round(minutes)),
    distanceMeters: Math.round(distanceMeters),
  };
};

export default function TrackTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  // Ensure tripId and studentId are strings (Expo Router params can be arrays)
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const studentId = Array.isArray(params.studentId) ? params.studentId[0] : params.studentId;

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [directionsError, setDirectionsError] = useState(false);
  const [calculatedETA, setCalculatedETA] = useState<{ minutes: number; distanceMeters: number } | null>(null);
  const [calculatingETA, setCalculatingETA] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const mapRef = useRef<MapView>(null);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const previousHeading = useRef<number | null>(null);
  const lastCalculatedLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastCalculatedTargetPointId = useRef<string | null>(null);
  const renderCountRef = useRef(0);
  const tripUpdateCountRef = useRef(0);
  const tripRef = useRef(trip);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTripDetailsRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);
  const isFetchingRef = useRef(false); // Prevent concurrent fetches
  const prevTripIdRef = useRef<string | null>(null);
  const prevCurrentPointIndexRef = useRef<number | null>(null);
  const tripPointsKeyRef = useRef<string>(''); // Track trip points key for memoization
  
  // Update ref when trip changes
  // CRITICAL: Update the ref whenever trip changes, not just when assignedCaptain.id changes
  // This ensures tripRef.current always has the latest trip data for comparisons in fetchTripDetails
  useEffect(() => {
    tripRef.current = trip;
    // Reset image load error when trip changes
    if (trip?.assignedCaptain?.id) {
      setImageLoadError(false);
    }
  }, [trip]); // Changed from [trip?.assignedCaptain?.id] to [trip] to update ref on ANY trip change
  
  // Track component renders
  renderCountRef.current += 1;
  // #region agent log
  const tripIdChanged = prevTripIdRef.current !== trip?.id;
  const currentPointIndexChanged = prevCurrentPointIndexRef.current !== (trip?.progress?.currentPointIndex ?? 0);
  if (tripIdChanged || currentPointIndexChanged) {
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:render',message:'Component render - trip state changed',data:{renderCount:renderCountRef.current,hasTrip:!!trip,tripId:trip?.id,prevTripId:prevTripIdRef.current,tripIdChanged,currentPointIndex:trip?.progress?.currentPointIndex ?? 0,prevCurrentPointIndex:prevCurrentPointIndexRef.current,currentPointIndexChanged,hasLocation:!!location?.location,studentId},timestamp:Date.now(),sessionId:'debug-session',runId:'render-state-change',hypothesisId:'E'})}).catch(()=>{});
    prevTripIdRef.current = trip?.id || null;
    prevCurrentPointIndexRef.current = trip?.progress?.currentPointIndex ?? 0;
  }
  if (renderCountRef.current <= 10 || renderCountRef.current % 5 === 0) {
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:render',message:'Component render',data:{renderCount:renderCountRef.current,hasTrip:!!trip,tripId:trip?.id,currentPointIndex:trip?.progress?.currentPointIndex ?? 0,hasLocation:!!location?.location,studentId},timestamp:Date.now(),sessionId:'debug-session',runId:'render',hypothesisId:'E'})}).catch(()=>{});
  }
  // #endregion

  const { location, connected, error: wsError } = useTripTracking({
    tripId: tripId as string,
    studentId: studentId as string,
    enabled: !!tripId && !!studentId,
  });

  useEffect(() => {
    // #region agent log
    const effectId = Date.now();
    const hasExistingInterval = !!refreshIntervalRef.current;
    const prevStudentId = (global as any).__prevTrackTripStudentId;
    const prevTripId = (global as any).__prevTrackTripTripId;
    const studentIdChanged = prevStudentId !== studentId;
    const tripIdChanged = prevTripId !== tripId;
    const hasFetchTripDetailsRef = !!fetchTripDetailsRef.current;
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:190',message:'Initial fetchTripDetails effect - setting up interval',data:{tripId,studentId,effectId,hasExistingInterval,prevStudentId,prevTripId,studentIdChanged,tripIdChanged,hasFetchTripDetailsRef},timestamp:Date.now(),sessionId:'debug-session',runId:'init-effect',hypothesisId:'A'})}).catch(()=>{});
    (global as any).__prevTrackTripStudentId = studentId;
    (global as any).__prevTrackTripTripId = tripId;
    // #endregion
    
    // Early return if tripId or studentId are missing
    if (!tripId || !studentId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:199',message:'Skipping effect - missing tripId or studentId',data:{tripId,studentId,effectId},timestamp:Date.now(),sessionId:'debug-session',runId:'skip-effect',hypothesisId:'V'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    // Clear any existing interval first
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:207',message:'Cleared existing interval before setting up new one',data:{tripId,studentId,effectId},timestamp:Date.now(),sessionId:'debug-session',runId:'clear-existing-interval',hypothesisId:'T'})}).catch(()=>{});
      // #endregion
    }
    
    // Call fetchTripDetails directly - it's stable via useCallback with [studentId, tripId] deps
    // The ref is only needed for the interval callback to access the latest function
    // Try immediately if ref is set, otherwise wait for it
    const doInitialFetch = () => {
      if (fetchTripDetailsRef.current) {
        console.log('[PARENT-DEBUG] Calling initial fetchTripDetails');
        fetchTripDetailsRef.current(false); // Show loading on initial fetch
      } else {
        console.log('[PARENT-DEBUG] fetchTripDetailsRef.current not ready, scheduling initial fetch');
        // Ref not set yet - wait for it (should be set by the effect at line 799)
        setTimeout(() => {
          if (fetchTripDetailsRef.current) {
            console.log('[PARENT-DEBUG] Calling delayed initial fetchTripDetails');
            fetchTripDetailsRef.current(false);
          }
        }, 50);
      }
    };
    
    // Call initial fetch
    doInitialFetch();
    
    // CRITICAL: ALWAYS set up the interval, even if fetchTripDetailsRef is not ready yet
    // The interval callback will check if the ref is ready when it runs
    // This ensures the interval is set up and will work once fetchTripDetails is available
    console.log('[PARENT-DEBUG] Setting up 5-second refresh interval');
    refreshIntervalRef.current = setInterval(() => {
      console.log('[PARENT-DEBUG] Interval tick - calling fetchTripDetails via ref');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:225',message:'Periodic refresh interval triggered',data:{tripId,studentId,intervalId:refreshIntervalRef.current,hasFetchTripDetailsRef:!!fetchTripDetailsRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'interval-trigger',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Use ref to get latest fetchTripDetails function
      if (fetchTripDetailsRef.current) {
        console.log('[PARENT-DEBUG] Calling fetchTripDetailsRef.current(true) from interval');
        fetchTripDetailsRef.current(true); // Silent refresh (don't show loading)
      } else {
        console.log('[PARENT-DEBUG] WARNING: fetchTripDetailsRef.current is null in interval callback!');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:282',message:'Interval callback - fetchTripDetailsRef is null',data:{tripId,studentId,intervalId:refreshIntervalRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'interval-ref-null',hypothesisId:'X'})}).catch(()=>{});
        // #endregion
      }
    }, 5000); // Refresh every 5 seconds
    console.log('[PARENT-DEBUG] Interval set up successfully with ID:', refreshIntervalRef.current);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:231',message:'Interval set up successfully',data:{tripId,studentId,effectId,intervalId:refreshIntervalRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'interval-setup-success',hypothesisId:'U'})}).catch(()=>{});
    // #endregion
    
    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:234',message:'Cleaning up refresh interval',data:{tripId,studentId,effectId,intervalId:refreshIntervalRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'cleanup',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [studentId, tripId]); // Depend on stable values instead of fetchTripDetails

  // Update driver marker rotation based on heading
  useEffect(() => {
    if (location?.location?.heading !== undefined) {
      const heading = location.location.heading;
      
      // Smooth rotation animation
      if (previousHeading.current !== null) {
        // Calculate shortest rotation path
        let targetRotation = heading;
        const currentRotation = previousHeading.current;
        const diff = targetRotation - currentRotation;
        
        // Handle 360/0 wrap-around
        if (Math.abs(diff) > 180) {
          if (diff > 0) {
            targetRotation = currentRotation - (360 - diff);
          } else {
            targetRotation = currentRotation + (360 + diff);
          }
        } else {
          targetRotation = currentRotation + diff;
        }
        
        Animated.timing(rotationAnim, {
          toValue: targetRotation,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } else {
        rotationAnim.setValue(heading);
      }
      
      previousHeading.current = heading;
    }
  }, [location?.location?.heading]);

  // Memoize student point and related values BEFORE conditional returns
  // This ensures hooks are always called in the same order
  const studentPoint = useMemo(() => trip?.studentPoint || trip?.points?.[0], [trip?.studentPoint?.id, trip?.points?.[0]?.id]);
  const studentPointId = useMemo(() => studentPoint?.id || null, [studentPoint?.id]);
  const currentPointIndex = trip?.progress?.currentPointIndex ?? 0;
  
  // Calculate the key string from trip points - MUST be before allPoints so it can be used in dependencies
  // CRITICAL: Memoize this to ensure React detects changes
  // IMPORTANT: We need to depend on the actual content, not just the array reference
  // Create a stable string representation that changes when content changes
  const tripPointsKeyString = useMemo(() => {
    if (!trip?.points) return '';
    // Create a key that includes both reachedAt and currentPointIndex to detect all changes
    const pointsKey = trip.points.map((p: any) => `${p.id}:${p.reachedAt || ''}`).join(',');
    const currentIdx = trip?.progress?.currentPointIndex ?? 0;
    const key = `${pointsKey}|idx:${currentIdx}`;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:336',message:'tripPointsKeyString calculated',data:{key,pointsKey,currentIdx,pointsCount:trip.points.length,pointsReachedAt:trip.points.map((p:any)=>({id:p.id,name:p.name,reachedAt:p.reachedAt})),tripId:trip?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'tripPointsKeyString-calc',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return key;
  }, [trip?.points, trip?.id, trip?.progress?.currentPointIndex]); // Include currentPointIndex in dependencies
  
  // CRITICAL FIX: allPoints must depend on tripPointsKeyString to update when content changes (reachedAt, currentPointIndex)
  // Previously only depended on length and ID, which don't change when driver confirms stops
  const allPoints = useMemo(() => {
    const points = trip?.points || [];
    const currentIdx = trip?.progress?.currentPointIndex ?? 0;
    console.log('[PARENT-DEBUG] allPoints useMemo recalculating', {
      pointsCount: points.length,
      currentPointIndex: currentIdx,
      tripId: trip?.id,
      pointsReachedAt: points.map((p: any) => ({ id: p.id, name: p.name, reachedAt: p.reachedAt }))
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:323',message:'allPoints useMemo recalculating',data:{pointsCount:points.length,pointsKey:tripPointsKeyString,currentPointIndex:currentIdx,hasTrip:!!trip,tripId:trip?.id,pointsReachedAt:points.map((p:any)=>({id:p.id,name:p.name,reachedAt:p.reachedAt}))},timestamp:Date.now(),sessionId:'debug-session',runId:'allPoints-memo',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return points;
  }, [trip?.points, trip?.id, tripPointsKeyString, currentPointIndex]); // Depend on trip.points reference AND tripPointsKeyString for content changes
  
  // Find the index of the student's stop in the trip points (before conditional returns)
  const studentPointIndex = useMemo(() => {
    if (!studentPoint || !studentPointId || !allPoints.length) return -1;
    return allPoints.findIndex((p: any) => p.id === studentPointId);
  }, [studentPointId, allPoints.length, studentPoint]);
  
  const tripPointsKey = useMemo(() => {
    // #region agent log
    const prevKey = tripPointsKeyRef.current;
    // #endregion
    if (!tripPointsKeyString) {
      tripPointsKeyRef.current = '';
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:231',message:'tripPointsKey useMemo - no points',data:{prevKey,newKey:''},timestamp:Date.now(),sessionId:'debug-session',runId:'tripPointsKey-memo',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return '';
    }
    if (tripPointsKeyString !== tripPointsKeyRef.current) {
      tripPointsKeyRef.current = tripPointsKeyString;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:238',message:'tripPointsKey useMemo - key changed',data:{prevKey,newKey:tripPointsKeyString,pointsCount:trip?.points?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'tripPointsKey-memo',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return tripPointsKeyString;
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:242',message:'tripPointsKey useMemo - key unchanged',data:{prevKey,newKey:tripPointsKeyString,pointsCount:trip?.points?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'tripPointsKey-memo',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return tripPointsKeyRef.current;
  }, [tripPointsKeyString]);
  
  // Create stable reference for studentPoint reachedAt to avoid unnecessary effect triggers
  const studentPointReachedAtKey = useMemo(() => {
    return trip?.studentPoint?.reachedAt || '';
  }, [trip?.studentPoint?.reachedAt]);

  // Update map region to show all relevant points
  // Only update when trip ID or location actually changes, not on every trip reference change
  const tripIdForMap = trip?.id;
  const locationLat = location?.location?.latitude;
  const locationLng = location?.location?.longitude;
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:251',message:'Map region update effect triggered',data:{hasTrip:!!trip,hasPoints:!!trip?.points,pointsCount:trip?.points?.length,hasLocation:!!location?.location,tripId:tripIdForMap},timestamp:Date.now(),sessionId:'debug-session',runId:'map-region-effect',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (trip?.points && trip.points.length > 0) {
      updateMapRegion();
    }
  }, [tripIdForMap, locationLat, locationLng]);

  // Calculate ETA using Google Maps Directions API when driver location or target point changes
  // Use debouncing to prevent too many API calls
  useEffect(() => {
    // #region agent log
    const prevTripId = (global as any).__prevTripId;
    const prevTripPointsLength = (global as any).__prevTripPointsLength;
    const prevTripPointsRef = (global as any).__prevTripPointsRef;
    const prevReachedAt = (global as any).__prevReachedAt;
    const prevCurrentPointIndex = (global as any).__prevCurrentPointIndex;
    const prevDriverLat = (global as any).__prevDriverLat;
    const prevDriverLng = (global as any).__prevDriverLng;
    const currentTripId = trip?.id;
    const currentTripPointsLength = trip?.points?.length;
    const currentTripPointsRef = trip?.points ? String(trip.points) : null;
    const currentReachedAt = trip?.studentPoint?.reachedAt;
    const currentCurrentPointIndex = trip?.progress?.currentPointIndex;
    const currentDriverLat = location?.location?.latitude;
    const currentDriverLng = location?.location?.longitude;
    const tripIdChanged = prevTripId !== currentTripId;
    const tripPointsLengthChanged = prevTripPointsLength !== currentTripPointsLength;
    const tripPointsRefChanged = prevTripPointsRef !== currentTripPointsRef;
    const reachedAtChanged = prevReachedAt !== currentReachedAt;
    const currentPointIndexChanged = prevCurrentPointIndex !== currentCurrentPointIndex;
    const driverLatChanged = prevDriverLat !== currentDriverLat;
    const driverLngChanged = prevDriverLng !== currentDriverLng;
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:229',message:'ETA calculation effect triggered',data:{hasTrip:!!trip,tripId:currentTripId,prevTripId,tripIdChanged,tripPointsLength:currentTripPointsLength,prevTripPointsLength,tripPointsLengthChanged,tripPointsRefChanged,reachedAt:currentReachedAt,prevReachedAt,reachedAtChanged,currentPointIndex:currentCurrentPointIndex,prevCurrentPointIndex,currentPointIndexChanged,driverLat:currentDriverLat,prevDriverLat,driverLatChanged,driverLng:currentDriverLng,prevDriverLng,driverLngChanged},timestamp:Date.now(),sessionId:'debug-session',runId:'eta-effect-trigger',hypothesisId:'D'})}).catch(()=>{});
    (global as any).__prevTripId = currentTripId;
    (global as any).__prevTripPointsLength = currentTripPointsLength;
    (global as any).__prevTripPointsRef = currentTripPointsRef;
    (global as any).__prevReachedAt = currentReachedAt;
    (global as any).__prevCurrentPointIndex = currentCurrentPointIndex;
    (global as any).__prevDriverLat = currentDriverLat;
    (global as any).__prevDriverLng = currentDriverLng;
    // #endregion
    if (!trip) return;
    
    const studentPoint = trip?.studentPoint || trip?.points?.[0];
    const driverLocation = location?.location;
    const allPoints = trip?.points || [];
    const currentPointIndex = trip?.progress?.currentPointIndex ?? 0;
    
    // Validate coordinates
    if (!driverLocation || !driverLocation.latitude || !driverLocation.longitude) {
      return;
    }
    
    // Find the index of the student's stop in the trip points
    const studentPointIndex = studentPoint 
      ? allPoints.findIndex((p: any) => p.id === studentPoint.id)
      : -1;
    
    // Get the actual student point from allPoints to ensure we have the latest reachedAt status
    const actualStudentPoint = studentPointIndex >= 0 ? allPoints[studentPointIndex] : studentPoint;
    
    // Check if the student's stop has been reached (driver pressed "Reached")
    // Check both studentPoint and the point from allPoints array
    // IMPORTANT: reachedAt must be a valid date string, not just truthy
    const actualStudentPointReached = actualStudentPoint?.reachedAt !== null && 
                                      actualStudentPoint?.reachedAt !== undefined && 
                                      actualStudentPoint?.reachedAt !== '';
    const studentPointReachedFromStudent = studentPoint?.reachedAt !== null && 
                                           studentPoint?.reachedAt !== undefined && 
                                           studentPoint?.reachedAt !== '';
    const studentPointReached = actualStudentPointReached || studentPointReachedFromStudent;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:240',message:'Checking reachedAt status',data:{studentPointIndex,currentPointIndex,actualStudentPointReached,studentPointReachedFromStudent,studentPointReached,actualStudentPointReachedAt:actualStudentPoint?.reachedAt,studentPointReachedAt:studentPoint?.reachedAt,actualStudentPointId:actualStudentPoint?.id,studentPointId:studentPoint?.id,allPointsReachedAt:allPoints.map((p:any)=>({id:p.id,name:p.name,reachedAt:p.reachedAt,reachedAtType:typeof p.reachedAt}))},timestamp:Date.now(),sessionId:'debug-session',runId:'reachedAt-check',hypothesisId:'J'})}).catch(()=>{});
    // #endregion
    
    // Determine target point based on whether student has been picked up
    // IMPORTANT: Only switch to drop-off AFTER driver confirms the stop (pressed "Reached")
    // Default to pickup point unless we're 100% sure the stop has been reached
    let targetPoint = null;
    let isPickedUp = false;
    
    if (studentPointIndex >= 0 && studentPoint) {
      // STRICT CHECK: Only show drop-off if reachedAt is a valid date string
      // This prevents false positives from empty strings, null, undefined, etc.
      // Check if reachedAt exists and is a non-empty string (valid date)
      const actualPointHasReachedAt = actualStudentPoint?.reachedAt && 
                                      typeof actualStudentPoint.reachedAt === 'string' && 
                                      actualStudentPoint.reachedAt.length > 0;
      const studentPointHasReachedAt = studentPoint?.reachedAt && 
                                       typeof studentPoint.reachedAt === 'string' && 
                                       studentPoint.reachedAt.length > 0;
      const hasValidReachedAt = actualPointHasReachedAt || studentPointHasReachedAt;
      
      if (hasValidReachedAt) {
        // Student's stop has been confirmed (driver pressed "Reached") - show ETA to drop-off
        targetPoint = allPoints[allPoints.length - 1] || null;
        isPickedUp = true;
      } else {
        // Student's stop has NOT been confirmed yet - show ETA to pickup point
        // This is the default and safe behavior
        targetPoint = studentPoint;
        isPickedUp = false;
      }
    } else {
      // Fallback: use next checkpoint or first point
      targetPoint = allPoints[currentPointIndex] || allPoints[0] || null;
    }
    
    // #region agent log
    const actualPointHasReachedAt = actualStudentPoint?.reachedAt && 
                                    typeof actualStudentPoint.reachedAt === 'string' && 
                                    actualStudentPoint.reachedAt.length > 0;
    const studentPointHasReachedAt = studentPoint?.reachedAt && 
                                     typeof studentPoint.reachedAt === 'string' && 
                                     studentPoint.reachedAt.length > 0;
    const hasValidReachedAt = actualPointHasReachedAt || studentPointHasReachedAt;
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:285',message:'Determining target point for ETA',data:{studentPointIndex,currentPointIndex,studentPointReached,actualPointHasReachedAt,studentPointHasReachedAt,hasValidReachedAt,isPickedUp,targetPointType:isPickedUp?'drop-off':'pickup',targetPointName:targetPoint?.name,targetPointId:targetPoint?.id,hasStudentPoint:!!studentPoint,studentPointName:studentPoint?.name,studentPointId:studentPoint?.id,actualStudentPointId:actualStudentPoint?.id,allPointsCount:allPoints.length,lastPointName:allPoints[allPoints.length-1]?.name,lastPointId:allPoints[allPoints.length-1]?.id,actualStudentPointReachedAt:actualStudentPoint?.reachedAt,actualStudentPointReachedAtType:typeof actualStudentPoint?.reachedAt,studentPointReachedAt:studentPoint?.reachedAt,studentPointReachedAtType:typeof studentPoint?.reachedAt},timestamp:Date.now(),sessionId:'debug-session',runId:'eta-target-selection',hypothesisId:'K'})}).catch(()=>{});
    // #endregion
    
    if (!targetPoint || !targetPoint.latitude || !targetPoint.longitude) {
      console.log('[PARENT-DEBUG] Invalid target point - clearing ETA', {
        hasTargetPoint: !!targetPoint,
        hasLat: !!targetPoint?.latitude,
        hasLng: !!targetPoint?.longitude
      });
      setCalculatedETA(null);
      lastCalculatedTargetPointId.current = null; // Reset target point tracking
      return;
    }
    
    // Validate coordinates are within valid range
    if (
      Math.abs(driverLocation.latitude) > 90 || 
      Math.abs(driverLocation.longitude) > 180 ||
      Math.abs(targetPoint.latitude) > 90 || 
      Math.abs(targetPoint.longitude) > 180
    ) {
      console.warn('[ETA Calculation] Invalid coordinates');
      return;
    }
    
    // Check if location has changed significantly (at least 50 meters) to avoid unnecessary API calls
    const hasLocationChanged = !lastCalculatedLocation.current || 
      Math.abs(driverLocation.latitude - lastCalculatedLocation.current.latitude) > 0.0005 || // ~50 meters
      Math.abs(driverLocation.longitude - lastCalculatedLocation.current.longitude) > 0.0005;
    
    // CRITICAL: Also check if target point changed (e.g., from pickup to drop-off)
    // This ensures ETA recalculates when driver confirms a stop, even if location hasn't moved
    const targetPointId = targetPoint?.id || null;
    const hasTargetPointChanged = lastCalculatedTargetPointId.current !== targetPointId;
    
    console.log('[PARENT-DEBUG] ETA recalculation check', {
      hasLocationChanged,
      hasTargetPointChanged,
      targetPointId,
      lastTargetPointId: lastCalculatedTargetPointId.current,
      targetPointName: targetPoint?.name,
      isPickedUp
    });
    
    if (!hasLocationChanged && !hasTargetPointChanged && calculatedETA) {
      // Neither location nor target point has changed, skip recalculation
      console.log('[PARENT-DEBUG] Skipping ETA recalculation - no changes detected');
      return;
    }
    
    // Debounce: wait 3 seconds before making API call to avoid too many requests
    const timeoutId = setTimeout(async () => {
      // Check if we're still calculating (prevent race conditions)
      if (calculatingETA) return;
      
      // Double-check location and target point haven't changed during debounce
      const currentTargetPointId = targetPoint?.id || null;
      if (lastCalculatedLocation.current &&
          lastCalculatedTargetPointId.current === currentTargetPointId &&
          Math.abs(driverLocation.latitude - lastCalculatedLocation.current.latitude) < 0.0005 &&
          Math.abs(driverLocation.longitude - lastCalculatedLocation.current.longitude) < 0.0005 &&
          calculatedETA) {
        console.log('[PARENT-DEBUG] Skipping ETA calculation - no changes during debounce');
        return;
      }
      
      console.log('[PARENT-DEBUG] Calculating ETA to target point', {
        targetPointName: targetPoint?.name,
        targetPointId: currentTargetPointId,
        isPickedUp,
        driverLocation: { lat: driverLocation.latitude, lng: driverLocation.longitude }
      });
      
      setCalculatingETA(true);
      try {
        const eta = await calculateETAToStudentStop(driverLocation, targetPoint, GOOGLE_MAPS_API_KEY);
        if (eta) {
          console.log('[PARENT-DEBUG] ETA calculated successfully', {
            minutes: eta.minutes,
            distanceMeters: eta.distanceMeters,
            targetPointName: targetPoint?.name
          });
          setCalculatedETA(eta);
          lastCalculatedLocation.current = { ...driverLocation };
          lastCalculatedTargetPointId.current = currentTargetPointId; // Track target point ID
        } else {
          console.log('[PARENT-DEBUG] ETA calculation returned null');
        }
      } catch (error: any) {
        console.error('Error calculating ETA:', error);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:260',message:'ETA calculation error in useEffect',data:{error:error?.message,errorStack:error?.stack,driverLocation,targetPoint},timestamp:Date.now(),sessionId:'debug-session',runId:'eta-calculation-error',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        setCalculatedETA(null);
        lastCalculatedTargetPointId.current = null; // Reset target point tracking on error
      } finally {
        setCalculatingETA(false);
      }
    }, 3000); // 3 second debounce
    
    // Cleanup timeout on unmount or when dependencies change
    return () => {
      clearTimeout(timeoutId);
    };
  }, [location?.location?.latitude, location?.location?.longitude, trip?.id, trip?.progress?.currentPointIndex, studentPointReachedAtKey, tripPointsKey]);

  const updateMapRegion = () => {
    const allPoints: Array<{ latitude: number; longitude: number }> = [];
    
    // Add all trip points
    if (trip?.points) {
      trip.points.forEach((point: any) => {
        if (point.latitude && point.longitude) {
          allPoints.push({
            latitude: point.latitude,
            longitude: point.longitude,
          });
        }
      });
    }
    
    // Add driver location if available
    if (location?.location) {
      allPoints.push({
        latitude: location.location.latitude,
        longitude: location.location.longitude,
      });
    }
    
    if (allPoints.length === 0) {
      // Fallback to student point
      const studentPoint = trip?.studentPoint || trip?.points?.[0];
      if (studentPoint?.latitude && studentPoint?.longitude) {
        setMapRegion({
          latitude: studentPoint.latitude,
          longitude: studentPoint.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
      return;
    }
    
    // Calculate bounding box
    const latitudes = allPoints.map(p => p.latitude);
    const longitudes = allPoints.map(p => p.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    
    // Add 20% padding
    const latPadding = (maxLat - minLat) * 0.2;
    const lngPadding = (maxLng - minLng) * 0.2;
    
    const newRegion: Region = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) + latPadding * 2 || 0.01,
      longitudeDelta: (maxLng - minLng) + lngPadding * 2 || 0.01,
    };
    
    setMapRegion(newRegion);
    
    // Smoothly animate to new region
    if (mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  };

  const fetchTripDetails = useCallback(async (silent = false) => {
    // CRITICAL: Log to console FIRST before any fetch calls
    console.log('[PARENT-DEBUG] fetchTripDetails called', { silent, studentId, tripId, timestamp: Date.now() });
    
    // Prevent concurrent fetches
    if (isFetchingRef.current && !silent) {
      console.log('[PARENT-DEBUG] fetchTripDetails skipped - already fetching');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:592',message:'fetchTripDetails skipped - already fetching',data:{silent,studentId,tripId},timestamp:Date.now(),sessionId:'debug-session',runId:'fetch-skipped',hypothesisId:'W'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    console.log('[PARENT-DEBUG] fetchTripDetails proceeding with fetch');
    // #region agent log
    const callStack = new Error().stack;
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:595',message:'fetchTripDetails called',data:{silent,studentId,tripId,callStack:callStack?.split('\n').slice(0,5).join(' | ')},timestamp:Date.now(),sessionId:'debug-session',runId:'fetch-call',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    isFetchingRef.current = true;
    try {
      if (!silent) {
        setLoading(true);
      }
      console.log('[PARENT-DEBUG] Making API call to fetch trip', { studentId, url: `/parent/students/${studentId}/trip` });
      const response = await api.get(`/parent/students/${studentId}/trip`);
      console.log('[PARENT-DEBUG] API call successful', { 
        success: response.data.success, 
        hasTrip: !!response.data.trip,
        tripId: response.data.trip?.id,
        currentPointIndex: response.data.trip?.progress?.currentPointIndex,
        pointsCount: response.data.trip?.points?.length,
        pointsIds: response.data.trip?.points?.map((p: any) => p.id),
        pointsReachedAt: response.data.trip?.points?.map((p: any) => ({ id: p.id, name: p.name, reachedAt: p.reachedAt }))
      });
      if (response.data.success && response.data.trip) {
        // Use ref to get latest trip value without causing dependency issues
        const currentTrip = tripRef.current;
        // #region agent log
        const prevTripId = currentTrip?.id;
        const prevTripPointsLength = currentTrip?.points?.length;
        const prevReachedAt = currentTrip?.studentPoint?.reachedAt;
        const prevCurrentPointIndex = currentTrip?.progress?.currentPointIndex;
        const newTripId = response.data.trip.id;
        const newTripPointsLength = response.data.trip.points?.length;
        const newReachedAt = response.data.trip.studentPoint?.reachedAt;
        const newCurrentPointIndex = response.data.trip.progress?.currentPointIndex;
        const tripIdChanged = prevTripId !== newTripId;
        const pointsLengthChanged = prevTripPointsLength !== newTripPointsLength;
        const reachedAtChanged = prevReachedAt !== newReachedAt;
        const currentPointIndexChanged = prevCurrentPointIndex !== newCurrentPointIndex;
        // Check if points data actually changed (compare IDs and reachedAt)
        const prevPointsKey = currentTrip?.points ? currentTrip.points.map((p: any) => `${p.id}:${p.reachedAt || ''}`).join(',') : '';
        const newPointsKey = response.data.trip.points ? response.data.trip.points.map((p: any) => `${p.id}:${p.reachedAt || ''}`).join(',') : '';
        const pointsDataChanged = prevPointsKey !== newPointsKey;
        
        console.log('[PARENT-DEBUG] Points key comparison', {
          prevPointsCount: currentTrip?.points?.length,
          newPointsCount: response.data.trip.points?.length,
          prevPointsKey: prevPointsKey.substring(0, 100),
          newPointsKey: newPointsKey.substring(0, 100),
          pointsDataChanged
        });
        
        // CRITICAL: Always update if currentPointIndex changed, even if other checks fail
        // This ensures the UI updates when driver confirms a stop
        const shouldUpdateTrip = tripIdChanged || pointsLengthChanged || reachedAtChanged || currentPointIndexChanged || pointsDataChanged || !currentTrip;
        
        // #region agent log
        // Log detailed comparison to debug why updates might be skipped
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:686',message:'Detailed trip comparison',data:{tripId:newTripId,prevTripId,tripIdChanged,prevTripPointsLength,newTripPointsLength,pointsLengthChanged,prevReachedAt,newReachedAt,reachedAtChanged,prevCurrentPointIndex,newCurrentPointIndex,currentPointIndexChanged,prevPointsKey,newPointsKey,pointsDataChanged,shouldUpdateTrip,hasCurrentTrip:!!currentTrip,prevPointsReachedAt:currentTrip?.points?.map((p:any)=>({id:p.id,reachedAt:p.reachedAt})),newPointsReachedAt:response.data.trip.points?.map((p:any)=>({id:p.id,reachedAt:p.reachedAt}))},timestamp:Date.now(),sessionId:'debug-session',runId:'trip-comparison-detailed',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:587',message:'Fetched trip details - checking if update needed',data:{tripId:newTripId,tripName:response.data.trip.name,hasStudentPoint:!!response.data.trip.studentPoint,studentPointReachedAt:newReachedAt,pointsCount:newTripPointsLength,pointsReachedAt:response.data.trip.points?.map((p:any)=>({id:p.id,name:p.name,reachedAt:p.reachedAt})),currentPointIndex:newCurrentPointIndex,prevTripId,tripIdChanged,prevTripPointsLength,pointsLengthChanged,prevReachedAt,reachedAtChanged,prevCurrentPointIndex,currentPointIndexChanged,pointsDataChanged,shouldUpdateTrip,hasTrip:!!currentTrip},timestamp:Date.now(),sessionId:'debug-session',runId:'trip-fetch',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        // CRITICAL: Compare BEFORE updating ref - we need to compare OLD vs NEW data
        // The ref should be updated AFTER comparison but BEFORE setTrip
        // This ensures the next interval run has the latest data for comparison
        
        // CRITICAL: Update ref AFTER comparison but BEFORE setTrip
        // This ensures:
        // 1. Comparison uses OLD data from ref (correct)
        // 2. Ref is updated with NEW data for next comparison (correct)
        // 3. State is updated if needed (triggers re-render)
        tripRef.current = response.data.trip;
        console.log('[PARENT-DEBUG] tripRef.current updated with latest trip data', { 
          tripId: newTripId,
          currentPointIndex: newCurrentPointIndex,
          pointsCount: newTripPointsLength,
          prevCurrentPointIndex,
          currentPointIndexChanged
        });
        
        // Only update trip state if data actually changed to prevent unnecessary re-renders
        if (shouldUpdateTrip) {
          tripUpdateCountRef.current += 1;
          const updateReason = tripIdChanged?'tripIdChanged':pointsLengthChanged?'pointsLengthChanged':reachedAtChanged?'reachedAtChanged':currentPointIndexChanged?'currentPointIndexChanged':pointsDataChanged?'pointsDataChanged':'noTrip';
          console.log('[PARENT-DEBUG] setTrip WILL BE CALLED - state will update', { 
            tripId: newTripId, 
            reason: updateReason,
            newCurrentPointIndex,
            prevCurrentPointIndex,
            currentPointIndexChanged
          });
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:590',message:'setTrip called - state update queued',data:{tripId:newTripId,tripUpdateCount:tripUpdateCountRef.current,reason:updateReason,newCurrentPointIndex,newReachedAt,newPointsKey},timestamp:Date.now(),sessionId:'debug-session',runId:'setTrip-call',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          setTrip(response.data.trip);
          console.log('[PARENT-DEBUG] setTrip COMPLETED - state update queued', { tripId: newTripId });
        } else {
          console.log('[PARENT-DEBUG] setTrip SKIPPED - no changes detected', {
            tripId: newTripId,
            prevCurrentPointIndex,
            newCurrentPointIndex,
            prevPointsKey: prevPointsKey.substring(0, 50),
            newPointsKey: newPointsKey.substring(0, 50),
            note: 'tripRef.current updated but setTrip skipped - no state change needed'
          });
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:597',message:'Skipping setTrip - no data changes detected',data:{tripId:newTripId,prevPointsKey,newPointsKey,prevReachedAt,newReachedAt,prevCurrentPointIndex,newCurrentPointIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'setTrip-skipped',hypothesisId:'H'})}).catch(()=>{});
          // #endregion
        }

        // Set initial map region only on first load
        if (!silent) {
          const studentPoint = response.data.trip.studentPoint || response.data.trip.points?.[0];
          if (studentPoint) {
            setMapRegion({
              latitude: studentPoint.latitude,
              longitude: studentPoint.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
        }
      }
    } catch (error) {
      console.error("[PARENT-DEBUG] Error fetching trip:", error);
      console.log('[PARENT-DEBUG] API call failed', { error: error?.message || String(error) });
    } finally {
      isFetchingRef.current = false;
      if (!silent) {
        setLoading(false);
      }
      console.log('[PARENT-DEBUG] fetchTripDetails completed');
    }
  }, [studentId, tripId]);
  
  // Update ref when fetchTripDetails changes
  useEffect(() => {
    fetchTripDetailsRef.current = fetchTripDetails;
  }, [fetchTripDetails]);

  // Track trip state changes to verify updates are being detected
  useEffect(() => {
    if (trip) {
      const currentIdx = trip.progress?.currentPointIndex ?? 0;
      const pointsReachedAt = trip.points?.map((p: any) => ({ id: p.id, name: p.name, reachedAt: p.reachedAt })) || [];
      console.log('[PARENT-DEBUG] Trip state changed - UI should update', {
        tripId: trip.id,
        currentPointIndex: currentIdx,
        pointsCount: trip.points?.length,
        pointsReachedAt: pointsReachedAt.map((p: any) => ({ id: p.id, name: p.name, reachedAt: p.reachedAt })),
        tripUpdateCount: tripUpdateCountRef.current
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:721',message:'Trip state changed',data:{tripId:trip.id,tripName:trip.name,currentPointIndex:currentIdx,pointsCount:trip.points?.length,pointsReachedAt,studentPointReachedAt:trip.studentPoint?.reachedAt,tripUpdateCount:tripUpdateCountRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'trip-state-change',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    }
  }, [trip?.id, trip?.progress?.currentPointIndex, tripPointsKeyString, trip?.studentPoint?.reachedAt]);

  // #region agent log
  // Track driverLocation changes and marker rendering
  // CRITICAL: These hooks MUST be before conditional returns
  const prevDriverLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const driverLocation = location?.location;
  useEffect(() => {
    if (driverLocation) {
      const prev = prevDriverLocationRef.current;
      const coordsChanged = !prev || 
        Math.abs(prev.latitude - driverLocation.latitude) > 0.0001 ||
        Math.abs(prev.longitude - driverLocation.longitude) > 0.0001;
      const refChanged = prev !== driverLocation;
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:707',message:'driverLocation changed',data:{hasDriverLocation:!!driverLocation,lat:driverLocation?.latitude,lng:driverLocation?.longitude,prevLat:prev?.latitude,prevLng:prev?.longitude,coordsChanged,refChanged,locationObjectRef:location?.location===driverLocation},timestamp:Date.now(),sessionId:'debug-session',runId:'driver-location-change',hypothesisId:'A'})}).catch(()=>{});
      prevDriverLocationRef.current = { latitude: driverLocation.latitude, longitude: driverLocation.longitude };
    } else {
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:707',message:'driverLocation is null/undefined',data:{hasLocation:!!location,hasLocationLocation:!!location?.location},timestamp:Date.now(),sessionId:'debug-session',runId:'driver-location-null',hypothesisId:'A'})}).catch(()=>{});
    }
  }, [driverLocation?.latitude, driverLocation?.longitude, location?.location]);
  // #endregion

  // Get route segments for directions - memoize to update when currentPointIndex or allPoints changes
  // CRITICAL: This hook MUST be before conditional returns
  const routeSegments = useMemo(() => {
    console.log('[PARENT-DEBUG] routeSegments useMemo recalculating', {
      allPointsCount: allPoints.length,
      currentPointIndex,
      tripId: trip?.id
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:781',message:'Recalculating route segments',data:{allPointsCount:allPoints.length,currentPointIndex,hasTrip:!!trip,tripId:trip?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'route-segments-recalc',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (allPoints.length < 2) return [];
    
    const segments = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
      const start = allPoints[i];
      const end = allPoints[i + 1];
      
      if (start.latitude && start.longitude && end.latitude && end.longitude) {
        const isCompleted = i < currentPointIndex;
        const isCurrent = i === currentPointIndex;
        segments.push({
          start: { latitude: start.latitude, longitude: start.longitude },
          end: { latitude: end.latitude, longitude: end.longitude },
          index: i,
          isCompleted,
          isCurrent,
        });
        console.log('[PARENT-DEBUG] Route segment created', {
          index: i,
          startName: start.name,
          endName: end.name,
          isCompleted,
          isCurrent,
          currentPointIndex
        });
        // #region agent log
        if (i === 0 || isCurrent || isCompleted) {
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:795',message:'Route segment created',data:{index:i,startName:start.name,endName:end.name,isCompleted,isCurrent,currentPointIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'route-segment-create',hypothesisId:'C'})}).catch(()=>{});
        }
        // #endregion
      }
    }
    console.log('[PARENT-DEBUG] routeSegments useMemo completed', {
      segmentsCount: segments.length,
      completedCount: segments.filter(s => s.isCompleted).length,
      currentIndex: segments.findIndex(s => s.isCurrent)
    });
    return segments;
  }, [allPoints, currentPointIndex, trip?.id]);

  const handleCallDriver = () => {
    if (trip?.assignedCaptain?.phone_number) {
      Linking.openURL(`tel:${trip.assignedCaptain.phone_number}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Trip not found</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Additional values (non-hooks, safe to use after conditional returns)
  // driverLocation is already defined above as a const
  
  // Determine target point based on whether student has been picked up
  let targetPoint = null;
  let isPickedUp = false;
  
  if (studentPointIndex >= 0) {
    if (currentPointIndex <= studentPointIndex) {
      // Student hasn't been picked up yet - show ETA to pickup point
      targetPoint = studentPoint;
      isPickedUp = false;
    } else {
      // Student has been picked up - show ETA to final destination (drop-off)
      targetPoint = allPoints[allPoints.length - 1] || null;
      isPickedUp = true;
    }
  } else {
    // Fallback: use next checkpoint or first point
    targetPoint = allPoints[currentPointIndex] || allPoints[0] || null;
  }
  
  // Use calculated ETA from Google Maps Directions API if available, otherwise fall back to location.eta
  const displayETA = calculatedETA || location?.eta;

  return (
    <View style={styles.container}>
      {/* Map */}
      {mapRegion && (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={mapRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={true}
          mapType="standard"
        >
          {/* Google Maps Directions for Route Segments */}
          {!directionsError && routeSegments.map((segment, idx) => (
            <MapDirections
              key={`route-${segment.index}-${segment.isCompleted ? 'completed' : segment.isCurrent ? 'current' : 'upcoming'}-${currentPointIndex}`}
              origin={segment.start}
              destination={segment.end}
              apikey={GOOGLE_MAPS_API_KEY}
              strokeWidth={4}
              strokeColor={
                segment.isCompleted
                  ? "#9ca3af" // Gray for completed
                  : segment.isCurrent
                  ? "#6366f1" // Blue for current
                  : "#dbeafe" // Light blue for upcoming
              }
              onError={(error) => {
                console.warn("Directions error:", error);
                if (idx === 0) {
                  setDirectionsError(true);
                }
              }}
            />
          ))}

          {/* Fallback: Simple polyline if directions fail */}
          {directionsError && routeSegments.length > 0 && (
            <Polyline
              coordinates={routeSegments.flatMap(seg => [
                seg.start,
                seg.end,
              ])}
              strokeColor="#6366f1"
              strokeWidth={4}
            />
          )}

          {/* All Trip Points Markers */}
          {allPoints.map((point: any, index: number) => {
            if (!point.latitude || !point.longitude || !point.id) return null;
            
            const isStudentPoint = point.id === studentPointId;
            const isStartPoint = index === 0;
            const isCompleted = index < currentPointIndex;
            const isCurrent = index === currentPointIndex;
            
            // #region agent log
            if (isCurrent || isCompleted || isStudentPoint) {
              fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:854',message:'Rendering point marker',data:{pointId:point.id,pointName:point.name,index,isStudentPoint,isStartPoint,isCompleted,isCurrent,currentPointIndex,reachedAt:point.reachedAt,renderCount:renderCountRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'point-marker-render',hypothesisId:'D'})}).catch(()=>{});
            }
            // #endregion
            
            return (
              <Marker
                key={`point-${point.id}`}
                coordinate={{
                  latitude: point.latitude,
                  longitude: point.longitude,
                }}
                title={point.name}
                description={isStudentPoint ? "Your pickup point" : `Stop ${index + 1}`}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View
                  style={[
                    styles.pointMarker,
                    isStudentPoint && styles.studentPointMarker,
                    isStartPoint && !isStudentPoint && styles.startPointMarker,
                    isCompleted && styles.completedPointMarker,
                    isCurrent && styles.currentPointMarker,
                  ]}
                >
                  {isStudentPoint ? (
                    <Ionicons name="location" size={28} color="#6366f1" />
                  ) : isStartPoint ? (
                    <Ionicons name="play-circle" size={24} color="#10b981" />
                  ) : (
                    <Ionicons name="ellipse" size={20} color="#6b7280" />
                  )}
                </View>
              </Marker>
            );
          })}

          {/* Driver Location with Rotation */}
          {driverLocation && (
            <>
              {/* #region agent log */}
              {(() => {
                fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:876',message:'Rendering driver marker',data:{hasDriverLocation:!!driverLocation,lat:driverLocation.latitude,lng:driverLocation.longitude,renderCount:renderCountRef.current,hasRotationAnim:!!rotationAnim},timestamp:Date.now(),sessionId:'debug-session',runId:'driver-marker-render',hypothesisId:'B'})}).catch(()=>{});
                return null;
              })()}
              {/* #endregion */}
              <Marker
                key="driver-marker"
                coordinate={(() => {
                  // #region agent log
                  const coord = {
                    latitude: driverLocation.latitude,
                    longitude: driverLocation.longitude,
                  };
                  fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:881',message:'Creating driver marker coordinate object',data:{lat:coord.latitude,lng:coord.longitude,renderCount:renderCountRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'driver-coord-create',hypothesisId:'C'})}).catch(()=>{});
                  return coord;
                  // #endregion
                })()}
                title="Driver"
                description={trip?.assignedCaptain?.name || "Driver"}
                anchor={{ x: 0.5, y: 0.5 }}
                flat={false}
                tracksViewChanges={false}
              >
              <Animated.View
                style={[
                  styles.driverMarker,
                  {
                    transform: [
                      {
                        rotate: rotationAnim.interpolate({
                          inputRange: [0, 360],
                          outputRange: ["0deg", "360deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons name="car" size={20} color="#fff" />
              </Animated.View>
            </Marker>
            </>
          )}

        </MapView>
      )}

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Connection Status */}
          <View style={styles.statusBar}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: connected ? "#10b981" : "#ef4444" },
              ]}
            />
            <Text style={styles.statusText}>
              {connected ? "Live Tracking" : wsError ? "Connection Error" : "Connecting..."}
            </Text>
            {directionsError && (
              <View style={styles.warningBadge}>
                <Ionicons name="warning" size={12} color="#f59e0b" />
                <Text style={styles.warningText}>Using simplified route</Text>
              </View>
            )}
          </View>

          {/* ETA Card */}
          {displayETA && (
            <View style={styles.etaCard}>
              <Text style={styles.etaLabel}>Estimated Arrival</Text>
              <Text style={styles.etaValue}>
                {Math.round(displayETA.minutes)} min
              </Text>
              <Text style={styles.etaDistance}>
                {Math.round(displayETA.distanceMeters / 1000 * 10) / 10} km away
              </Text>
              {/* #region agent log */}
              {(() => {
                const studentPoint = trip?.studentPoint || trip?.points?.[0];
                const allPoints = trip?.points || [];
                const currentPointIndex = trip?.progress?.currentPointIndex ?? 0;
                const studentPointIndex = studentPoint 
                  ? allPoints.findIndex((p: any) => p.id === studentPoint.id)
                  : -1;
                const isPickedUp = studentPointIndex >= 0 && currentPointIndex > studentPointIndex;
                const targetPoint = isPickedUp 
                  ? (allPoints[allPoints.length - 1] || null)
                  : (studentPoint || null);
                
                fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:560',message:'Displaying ETA with Google Maps Directions API',data:{displayETAMinutes:displayETA.minutes,displayETADistanceMeters:displayETA.distanceMeters,displayETADistanceKm:displayETA.distanceMeters/1000,currentPointIndex,studentPointIndex,isPickedUp,targetPointType:isPickedUp?'drop-off':'pickup',targetPointName:targetPoint?.name,targetPointLat:targetPoint?.latitude,targetPointLng:targetPoint?.longitude,hasStudentPoint:!!studentPoint,studentPointName:studentPoint?.name,driverLocation:driverLocation,usingCalculatedETA:!!calculatedETA,calculatedETAMinutes:calculatedETA?.minutes,calculatedETADistanceMeters:calculatedETA?.distanceMeters,usingLocationETA:!calculatedETA&&!!location?.eta,locationETAMinutes:location?.eta?.minutes,locationETADistanceMeters:location?.eta?.distanceMeters,calculatingETA},timestamp:Date.now(),sessionId:'debug-session',runId:'eta-display',hypothesisId:'F'})}).catch(()=>{});
                return null;
              })()}
              {/* #endregion */}
            </View>
          )}

          {/* Driver Info Card */}
          {trip.assignedCaptain && (
            <View style={styles.driverCard}>
              <View style={styles.driverHeader}>
                <View style={styles.driverAvatar}>
                  {trip.assignedCaptain.selfiePhoto && !imageLoadError ? (
                    <Image
                      source={{ uri: trip.assignedCaptain.selfiePhoto }}
                      style={styles.avatarImage}
                      onError={() => setImageLoadError(true)}
                      resizeMode="cover"
                    />
                  ) : (
                    trip.assignedCaptain.selfiePhoto && imageLoadError ? (
                      <Text style={styles.avatarText}>
                        {trip.assignedCaptain.name.charAt(0)}
                      </Text>
                    ) : (
                      <Ionicons name="person" size={24} color="#6366f1" />
                    )
                  )}
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>
                    {trip.assignedCaptain.name}
                  </Text>
                  <Text style={styles.driverDetails}>
                    {trip.assignedCaptain.vehicle_type} •{" "}
                    {trip.assignedCaptain.registration_number}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={handleCallDriver}
                >
                  <Ionicons name="call" size={24} color="#6366f1" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Trip Info */}
          <View style={styles.tripInfoCard}>
            <Text style={styles.tripName}>{trip?.name}</Text>
            {studentPoint && (
              <View style={styles.pickupInfo}>
                <Ionicons name="location" size={16} color="#6366f1" />
                <Text style={styles.pickupPoint}>
                  Pickup: {studentPoint.name}
                </Text>
              </View>
            )}
            {trip?.progress && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  Stop {trip.progress.currentPointIndex + 1} of{" "}
                  {allPoints.length}
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${((trip.progress.currentPointIndex + 1) / allPoints.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
            {!driverLocation && connected && (
              <View style={styles.infoMessage}>
                <Ionicons name="information-circle" size={16} color="#6b7280" />
                <Text style={styles.infoText}>
                  Waiting for driver location update...
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "50%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  etaCard: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    margin: 15,
    borderRadius: 12,
  },
  etaLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 5,
  },
  etaValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#6366f1",
  },
  etaDistance: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 5,
  },
  driverCard: {
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#6366f1",
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  driverDetails: {
    fontSize: 14,
    color: "#6b7280",
  },
  callButton: {
    padding: 10,
  },
  tripInfoCard: {
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tripName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  pickupPoint: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressText: {
    fontSize: 14,
    color: "#6366f1",
    fontWeight: "500",
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#6366f1",
    borderRadius: 3,
  },
  pickupInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  warningText: {
    fontSize: 11,
    color: "#f59e0b",
    marginLeft: 4,
  },
  infoMessage: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 8,
  },
  pointMarker: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  studentPointMarker: {
    backgroundColor: "#dbeafe",
    borderWidth: 2,
    borderColor: "#6366f1",
  },
  startPointMarker: {
    backgroundColor: "#d1fae5",
    borderWidth: 2,
    borderColor: "#10b981",
  },
  completedPointMarker: {
    backgroundColor: "#f3f4f6",
    opacity: 0.7,
  },
  currentPointMarker: {
    backgroundColor: "#dbeafe",
    borderWidth: 2,
    borderColor: "#6366f1",
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  errorText: {
    fontSize: 18,
    color: "#ef4444",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#6366f1",
    padding: 15,
    borderRadius: 8,
    paddingHorizontal: 30,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});







