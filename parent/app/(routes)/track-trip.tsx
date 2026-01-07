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
  const mapRef = useRef<MapView>(null);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const previousHeading = useRef<number | null>(null);
  const lastCalculatedLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const renderCountRef = useRef(0);
  const tripUpdateCountRef = useRef(0);
  const tripRef = useRef(trip);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTripDetailsRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);
  const isFetchingRef = useRef(false); // Prevent concurrent fetches
  
  // Update ref when trip changes
  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);
  
  // Track component renders
  renderCountRef.current += 1;
  // #region agent log
  if (renderCountRef.current <= 10 || renderCountRef.current % 5 === 0) {
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:render',message:'Component render',data:{renderCount:renderCountRef.current,hasTrip:!!trip,tripId:trip?.id,hasLocation:!!location?.location,studentId},timestamp:Date.now(),sessionId:'debug-session',runId:'render',hypothesisId:'E'})}).catch(()=>{});
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
    // We need to call it here to ensure initial fetch happens, but we can't depend on fetchTripDetails
    // in the dependency array because that would cause the effect to re-run when it's recreated
    // So we use a small delay to ensure fetchTripDetails is defined
    const doFetch = () => {
      if (fetchTripDetailsRef.current) {
        fetchTripDetailsRef.current();
      }
    };
    
    // Try immediately, fallback to next tick if ref not set yet
    if (fetchTripDetailsRef.current) {
      doFetch();
    } else {
      // Ref not set yet - wait for it (should be set by the effect at line 660)
      const timeoutId = setTimeout(() => {
        doFetch();
      }, 10);
      return () => {
        clearTimeout(timeoutId);
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
    
    // Refresh trip details periodically to get updated reachedAt status
    // This ensures we detect when driver presses "Reached"
    refreshIntervalRef.current = setInterval(() => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:225',message:'Periodic refresh interval triggered',data:{tripId,studentId,intervalId:refreshIntervalRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'interval-trigger',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Use ref to get latest fetchTripDetails function
      if (fetchTripDetailsRef.current) {
        fetchTripDetailsRef.current(true); // Silent refresh (don't show loading)
      }
    }, 5000); // Refresh every 5 seconds
    
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

  // Create stable reference for trip points to avoid unnecessary effect triggers
  // Use a ref to track previous key and only recalculate when content actually changes
  const tripPointsKeyRef = useRef<string>('');
  // Calculate the key string from trip points
  const tripPointsKeyString = trip?.points 
    ? trip.points.map((p: any) => `${p.id}:${p.reachedAt || ''}`).join(',')
    : '';
  
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
      setCalculatedETA(null);
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
    
    if (!hasLocationChanged && calculatedETA) {
      // Location hasn't changed significantly, skip recalculation
      return;
    }
    
    // Debounce: wait 3 seconds before making API call to avoid too many requests
    const timeoutId = setTimeout(async () => {
      // Check if we're still calculating (prevent race conditions)
      if (calculatingETA) return;
      
      // Double-check location hasn't changed during debounce
      if (lastCalculatedLocation.current &&
          Math.abs(driverLocation.latitude - lastCalculatedLocation.current.latitude) < 0.0005 &&
          Math.abs(driverLocation.longitude - lastCalculatedLocation.current.longitude) < 0.0005 &&
          calculatedETA) {
        return;
      }
      
      setCalculatingETA(true);
      try {
        const eta = await calculateETAToStudentStop(driverLocation, targetPoint, GOOGLE_MAPS_API_KEY);
        if (eta) {
          setCalculatedETA(eta);
          lastCalculatedLocation.current = { ...driverLocation };
        }
      } catch (error: any) {
        console.error('Error calculating ETA:', error);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:260',message:'ETA calculation error in useEffect',data:{error:error?.message,errorStack:error?.stack,driverLocation,targetPoint},timestamp:Date.now(),sessionId:'debug-session',runId:'eta-calculation-error',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        setCalculatedETA(null);
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
    // Prevent concurrent fetches
    if (isFetchingRef.current && !silent) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:592',message:'fetchTripDetails skipped - already fetching',data:{silent,studentId,tripId},timestamp:Date.now(),sessionId:'debug-session',runId:'fetch-skipped',hypothesisId:'W'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    // #region agent log
    const callStack = new Error().stack;
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:595',message:'fetchTripDetails called',data:{silent,studentId,tripId,callStack:callStack?.split('\n').slice(0,5).join(' | ')},timestamp:Date.now(),sessionId:'debug-session',runId:'fetch-call',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    isFetchingRef.current = true;
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await api.get(`/parent/students/${studentId}/trip`);
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
        const shouldUpdateTrip = tripIdChanged || pointsLengthChanged || reachedAtChanged || currentPointIndexChanged || pointsDataChanged || !currentTrip;
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:587',message:'Fetched trip details - checking if update needed',data:{tripId:newTripId,tripName:response.data.trip.name,hasStudentPoint:!!response.data.trip.studentPoint,studentPointReachedAt:newReachedAt,pointsCount:newTripPointsLength,pointsReachedAt:response.data.trip.points?.map((p:any)=>({id:p.id,name:p.name,reachedAt:p.reachedAt})),currentPointIndex:newCurrentPointIndex,prevTripId,tripIdChanged,prevTripPointsLength,pointsLengthChanged,prevReachedAt,reachedAtChanged,prevCurrentPointIndex,currentPointIndexChanged,pointsDataChanged,shouldUpdateTrip,hasTrip:!!currentTrip},timestamp:Date.now(),sessionId:'debug-session',runId:'trip-fetch',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        // Only update trip state if data actually changed to prevent unnecessary re-renders
        if (shouldUpdateTrip) {
          tripUpdateCountRef.current += 1;
          setTrip(response.data.trip);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:590',message:'setTrip called - state update queued',data:{tripId:newTripId,tripUpdateCount:tripUpdateCountRef.current,reason:tripIdChanged?'tripIdChanged':pointsLengthChanged?'pointsLengthChanged':reachedAtChanged?'reachedAtChanged':currentPointIndexChanged?'currentPointIndexChanged':pointsDataChanged?'pointsDataChanged':'noTrip'},timestamp:Date.now(),sessionId:'debug-session',runId:'setTrip-call',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'track-trip.tsx:597',message:'Skipping setTrip - no data changes detected',data:{tripId:newTripId},timestamp:Date.now(),sessionId:'debug-session',runId:'setTrip-skipped',hypothesisId:'H'})}).catch(()=>{});
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
      console.error("Error fetching trip:", error);
    } finally {
      isFetchingRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, [studentId, tripId]);
  
  // Update ref when fetchTripDetails changes
  useEffect(() => {
    fetchTripDetailsRef.current = fetchTripDetails;
  }, [fetchTripDetails]);

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

  const studentPoint = trip?.studentPoint || trip?.points?.[0];
  const driverLocation = location?.location;
  const allPoints = trip?.points || [];
  const currentPointIndex = trip?.progress?.currentPointIndex ?? 0;
  
  // Find the index of the student's stop in the trip points
  const studentPointIndex = studentPoint 
    ? allPoints.findIndex((p: any) => p.id === studentPoint.id)
    : -1;
  
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

  // Get route segments for directions
  const getRouteSegments = () => {
    if (allPoints.length < 2) return [];
    
    const segments = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
      const start = allPoints[i];
      const end = allPoints[i + 1];
      
      if (start.latitude && start.longitude && end.latitude && end.longitude) {
        segments.push({
          start: { latitude: start.latitude, longitude: start.longitude },
          end: { latitude: end.latitude, longitude: end.longitude },
          index: i,
          isCompleted: i < currentPointIndex,
          isCurrent: i === currentPointIndex,
        });
      }
    }
    return segments;
  };

  const routeSegments = getRouteSegments();

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
              key={`route-${idx}`}
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
            if (!point.latitude || !point.longitude) return null;
            
            const isStudentPoint = point.id === studentPoint?.id;
            const isStartPoint = index === 0;
            const isCompleted = index < currentPointIndex;
            const isCurrent = index === currentPointIndex;
            
            return (
              <Marker
                key={`point-${point.id || index}`}
                coordinate={{
                  latitude: point.latitude,
                  longitude: point.longitude,
                }}
                title={point.name}
                description={isStudentPoint ? "Your pickup point" : `Stop ${index + 1}`}
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
            <Marker
              coordinate={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
              }}
              title="Driver"
              description={trip?.assignedCaptain?.name || "Driver"}
              anchor={{ x: 0.5, y: 0.5 }}
              flat={false}
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
                  {trip.assignedCaptain.selfiePhoto ? (
                    <Text style={styles.avatarText}>
                      {trip.assignedCaptain.name.charAt(0)}
                    </Text>
                  ) : (
                    <Ionicons name="person" size={24} color="#6366f1" />
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







