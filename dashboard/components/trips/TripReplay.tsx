"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  Polyline,
} from "@react-google-maps/api";
import api from "@/lib/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import {
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const libraries: ("drawing" | "geometry" | "places" | "visualization")[] = [
  "places",
];

interface TripReplayProps {
  tripId: string;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  speed?: number;
  isRouteDeviation?: boolean;
  isCheckpointReached?: boolean;
  checkpointIndex?: number;
}

interface Checkpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  reachedAt?: string | null;
}

interface TimelineEvent {
  type: "checkpoint" | "deviation" | "idle" | "speed";
  timestamp: Date;
  description: string;
  checkpointIndex?: number;
}

/**
 * Interpolate intermediate location points between existing points for smoother animation
 * Creates points at regular time intervals (every 2 seconds) between consecutive locations
 */
function interpolateLocations(
  locations: LocationPoint[],
  durationMinutes: number
): LocationPoint[] {
  if (locations.length < 2) {
    return locations;
  }

  const interpolated: LocationPoint[] = [];
  const targetIntervalSeconds = 2; // Create a point every 2 seconds
  const targetIntervalMs = targetIntervalSeconds * 1000;

  for (let i = 0; i < locations.length - 1; i++) {
    const start = locations[i];
    const end = locations[i + 1];

    // Always include the start point
    interpolated.push(start);

    const timeDiff = end.timestamp.getTime() - start.timestamp.getTime();
    const distance = Math.sqrt(
      Math.pow(end.latitude - start.latitude, 2) +
        Math.pow(end.longitude - start.longitude, 2)
    );

    // Only interpolate if there's a meaningful time gap (more than interval)
    if (timeDiff > targetIntervalMs) {
      const numInterpolated = Math.floor(timeDiff / targetIntervalMs);

      for (let j = 1; j <= numInterpolated; j++) {
        const ratio = (j * targetIntervalMs) / timeDiff;
        const clampedRatio = Math.min(ratio, 1); // Ensure we don't exceed end point

        // Linear interpolation
        const lat =
          start.latitude + (end.latitude - start.latitude) * clampedRatio;
        const lng =
          start.longitude + (end.longitude - start.longitude) * clampedRatio;
        const timestamp = new Date(
          start.timestamp.getTime() + j * targetIntervalMs
        );

        // Interpolate speed if available
        const speed =
          start.speed !== undefined && end.speed !== undefined
            ? start.speed + (end.speed - start.speed) * clampedRatio
            : start.speed ?? end.speed;

        const interpolatedPoint: LocationPoint = {
          latitude: lat,
          longitude: lng,
          timestamp: timestamp,
          ...(speed !== undefined && speed !== null && { speed }),
          ...((start.isRouteDeviation || end.isRouteDeviation) && {
            isRouteDeviation: true,
          }),
          isCheckpointReached: false, // Interpolated points aren't checkpoints
        };

        interpolated.push(interpolatedPoint);
      }
    }
  }

  // Always include the last point
  interpolated.push(locations[locations.length - 1]);

  return interpolated;
}

export default function TripReplay({ tripId }: TripReplayProps) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey,
    libraries: libraries,
  });

  const [locationHistory, setLocationHistory] = useState<LocationPoint[]>([]);
  const [plannedRoute, setPlannedRoute] = useState<
    Array<{ lat: number; lng: number }>
  >([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [isInterpolated, setIsInterpolated] = useState(false);

  const mapRef = useRef<google.maps.Map | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const locationHistoryRef = useRef<LocationPoint[]>([]);
  const isPlayingRef = useRef<boolean>(false);

  // Fetch location history
  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch location history with pagination to get all records
        console.log(
          `[TripReplay] Starting to fetch location history for trip ${tripId}`
        );
        let allLocations: any[] = [];
        let page = 1;
        let hasMore = true;
        const pageSize = 1000;
        let totalFromAPI = 0;

        while (hasMore) {
          try {
            const historyResponse = await api.get(
              `/admin/trips/${tripId}/location-history?page=${page}&limit=${pageSize}`
            );

            // Log raw API response structure
            console.log(`[TripReplay] API Response for page ${page}:`, {
              hasLocationHistory: !!historyResponse.data.locationHistory,
              locationHistoryLength:
                historyResponse.data.locationHistory?.length || 0,
              pagination: historyResponse.data.pagination,
              responseKeys: Object.keys(historyResponse.data || {}),
            });

            const pageLocations = historyResponse.data.locationHistory || [];
            console.log(
              `[TripReplay] Raw page ${page} locations count: ${pageLocations.length}`
            );

            if (pageLocations.length > 0) {
              console.log(`[TripReplay] Sample location from page ${page}:`, {
                latitude: pageLocations[0].latitude,
                longitude: pageLocations[0].longitude,
                timestamp: pageLocations[0].timestamp,
              });
            }

            allLocations = allLocations.concat(pageLocations);

            // Check if there are more pages
            const pagination = historyResponse.data.pagination;
            const totalPages = pagination?.totalPages || 1;
            const total = pagination?.total || 0;
            totalFromAPI = total; // Store total from API

            console.log(
              `[TripReplay] Fetched page ${page}/${totalPages}, ` +
                `${pageLocations.length} locations (total so far: ${allLocations.length}/${total})`
            );

            hasMore = page < totalPages;
            page++;
          } catch (pageError: any) {
            console.error(
              `[TripReplay] Error fetching page ${page} of location history:`,
              pageError
            );
            console.error(`[TripReplay] Error details:`, {
              message: pageError.message,
              response: pageError.response?.data,
              status: pageError.response?.status,
            });
            // Stop pagination on error, but use what we have so far
            hasMore = false;
          }
        }

        console.log(
          `[TripReplay] Total raw locations fetched: ${allLocations.length} (API reported total: ${totalFromAPI})`
        );

        // Process all locations - map step
        console.log(
          `[TripReplay] Processing ${allLocations.length} raw locations...`
        );
        const mappedLocations: LocationPoint[] = allLocations.map(
          (loc: any) => ({
            latitude: loc.latitude,
            longitude: loc.longitude,
            timestamp: new Date(loc.timestamp),
            speed: loc.speed,
            isRouteDeviation: loc.isRouteDeviation,
            isCheckpointReached: loc.isCheckpointReached,
            checkpointIndex: loc.checkpointIndex,
          })
        );
        console.log(
          `[TripReplay] After mapping: ${mappedLocations.length} locations`
        );

        // Filter step
        const beforeFilterCount = mappedLocations.length;
        const filteredLocations = mappedLocations.filter(
          (loc: any) =>
            typeof loc.latitude === "number" &&
            typeof loc.longitude === "number" &&
            !isNaN(loc.latitude) &&
            !isNaN(loc.longitude) &&
            isFinite(loc.latitude) &&
            isFinite(loc.longitude)
        );
        const filteredOutCount = beforeFilterCount - filteredLocations.length;
        if (filteredOutCount > 0) {
          console.warn(
            `[TripReplay] Filtered out ${filteredOutCount} invalid locations`
          );
        }
        console.log(
          `[TripReplay] After filtering: ${filteredLocations.length} valid locations`
        );

        // Sort step
        const processedLocations = filteredLocations.sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        console.log(
          `[TripReplay] After sorting: ${processedLocations.length} locations (sorted by timestamp)`
        );

        // Log summary for debugging
        if (processedLocations.length > 0) {
          const startTime = processedLocations[0].timestamp;
          const endTime =
            processedLocations[processedLocations.length - 1].timestamp;
          const durationMs = endTime.getTime() - startTime.getTime();
          const durationMinutes = durationMs / (1000 * 60);
          const expectedMinLocations = Math.max(
            1,
            Math.floor(durationMinutes * 2)
          ); // Expect at least 2 per minute

          console.log(
            `[TripReplay] Loaded ${processedLocations.length} location points. ` +
              `Time range: ${startTime.toLocaleString()} ` +
              `to ${endTime.toLocaleString()} ` +
              `(Duration: ${durationMinutes.toFixed(1)} minutes)`
          );
          console.log(
            `[TripReplay] Expected minimum locations for ${durationMinutes.toFixed(
              1
            )} minute trip: ~${expectedMinLocations} ` +
              `(actual: ${processedLocations.length})`
          );

          // Warn if suspiciously few locations for trip duration
          const hasInsufficientData =
            durationMinutes > 5 &&
            processedLocations.length < expectedMinLocations * 0.1;
          if (hasInsufficientData) {
            const warningMsg = `Very few location points (${
              processedLocations.length
            }) for a ${durationMinutes.toFixed(
              1
            )}-minute trip. Expected at least ${expectedMinLocations}. Location tracking may have been incomplete.`;
            console.warn(`[TripReplay] ⚠️ WARNING: ${warningMsg}`);
            setLocationWarning(warningMsg);
          } else {
            setLocationWarning(null);
          }

          // Apply interpolation if we have very few points (less than 10) but more than 1
          let finalLocations = processedLocations;
          if (processedLocations.length > 1 && processedLocations.length < 10) {
            console.log(
              `[TripReplay] Interpolating locations: ${processedLocations.length} -> more points for smoother animation`
            );
            finalLocations = interpolateLocations(
              processedLocations,
              durationMinutes
            );
            setIsInterpolated(true);
            console.log(
              `[TripReplay] After interpolation: ${finalLocations.length} location points`
            );
          } else {
            setIsInterpolated(false);
          }

          setLocationHistory(finalLocations);
          locationHistoryRef.current = finalLocations;
        } else {
          console.warn(
            "[TripReplay] No valid location data found after processing"
          );
          setLocationWarning("No location data available for this trip.");
          setIsInterpolated(false);
          setLocationHistory([]);
          locationHistoryRef.current = [];
        }

        // Build timeline events
        const events: TimelineEvent[] = [];
        processedLocations.forEach((loc: LocationPoint, index: number) => {
          if (
            loc.isCheckpointReached &&
            typeof loc.checkpointIndex === "number"
          ) {
            const checkpoint = trip.points[loc.checkpointIndex];
            if (checkpoint) {
              events.push({
                type: "checkpoint",
                timestamp: loc.timestamp,
                description: `Reached: ${checkpoint.name}`,
                checkpointIndex: loc.checkpointIndex,
              });
            }
          }
          if (
            loc.isRouteDeviation &&
            index > 0 &&
            !processedLocations[index - 1].isRouteDeviation
          ) {
            events.push({
              type: "deviation",
              timestamp: loc.timestamp,
              description: "Route deviation started",
            });
          }
        });

        setTimelineEvents(events);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching trip data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [tripId]);

  // Reset currentTimeIndex when locationHistory changes (but not during active playback)
  useEffect(() => {
    if (!isPlayingRef.current && locationHistory.length > 0) {
      setCurrentTimeIndex(0);
      console.log(
        "[TripReplay] Reset currentTimeIndex to 0 (locationHistory changed, playback not active)"
      );
    }
  }, [locationHistory.length]);

  // Sync refs with state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Sync locationHistoryRef with locationHistory state
  useEffect(() => {
    locationHistoryRef.current = locationHistory;
  }, [locationHistory]);

  // Playback control
  useEffect(() => {
    // Clear any existing interval first
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    if (isPlaying && locationHistoryRef.current.length > 0) {
      const interval = 1000 / playbackSpeed; // Adjust interval based on speed
      console.log(
        `[TripReplay] Starting playback: interval=${interval}ms, speed=${playbackSpeed}x, total locations=${locationHistoryRef.current.length}`
      );

      playbackIntervalRef.current = setInterval(() => {
        setCurrentTimeIndex((prev) => {
          const nextIndex = prev + 1;
          const maxIndex = locationHistoryRef.current.length - 1;

          if (nextIndex > maxIndex) {
            console.log(
              `[TripReplay] Playback complete: reached end at index ${maxIndex}`
            );
            setIsPlaying(false);
            return maxIndex;
          }

          if (nextIndex % 50 === 0 || nextIndex <= 5) {
            console.log(
              `[TripReplay] Playback progress: index ${nextIndex}/${maxIndex}`
            );
          }

          return nextIndex;
        });
      }, interval);
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
        console.log("[TripReplay] Playback interval cleared");
      }
    };
  }, [isPlaying, playbackSpeed]);

  // Update map when time index changes
  useEffect(() => {
    if (
      isLoaded &&
      mapRef.current &&
      locationHistory.length > 0 &&
      currentTimeIndex >= 0 &&
      currentTimeIndex < locationHistory.length
    ) {
      const currentLocation = locationHistory[currentTimeIndex];
      if (
        currentLocation &&
        typeof currentLocation.latitude === "number" &&
        typeof currentLocation.longitude === "number" &&
        !isNaN(currentLocation.latitude) &&
        !isNaN(currentLocation.longitude) &&
        isFinite(currentLocation.latitude) &&
        isFinite(currentLocation.longitude)
      ) {
        mapRef.current.setCenter({
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
        });
      } else {
        console.warn(
          `[TripReplay] Invalid location at index ${currentTimeIndex}:`,
          currentLocation
        );
      }
    } else if (
      currentTimeIndex < 0 ||
      currentTimeIndex >= locationHistory.length
    ) {
      console.warn(
        `[TripReplay] currentTimeIndex out of bounds: ${currentTimeIndex} (valid range: 0-${
          locationHistory.length - 1
        })`
      );
    }
  }, [isLoaded, currentTimeIndex, locationHistory]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Auto-fit map on load
  useEffect(() => {
    if (isLoaded && mapRef.current && plannedRoute.length > 0) {
      const bounds = new google.maps.LatLngBounds();

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

      if (locationHistory.length > 0) {
        locationHistory.forEach((loc) => {
          if (
            typeof loc.latitude === "number" &&
            typeof loc.longitude === "number" &&
            !isNaN(loc.latitude) &&
            !isNaN(loc.longitude) &&
            isFinite(loc.latitude) &&
            isFinite(loc.longitude)
          ) {
            bounds.extend(new google.maps.LatLng(loc.latitude, loc.longitude));
          }
        });
      }

      if (bounds.getNorthEast() && bounds.getSouthWest()) {
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [isLoaded, plannedRoute, locationHistory]);

  const handlePlayPause = () => {
    const newPlayingState = !isPlaying;
    console.log(
      `[TripReplay] Play/Pause: ${
        newPlayingState ? "Play" : "Pause"
      } at index ${currentTimeIndex}/${locationHistory.length - 1}`
    );
    setIsPlaying(newPlayingState);
  };

  const handleRewind = () => {
    setIsPlaying(false);
    setCurrentTimeIndex(0);
  };

  const handleSeek = (value: number) => {
    setIsPlaying(false);
    const index = Math.floor((value / 100) * locationHistory.length);
    setCurrentTimeIndex(Math.min(index, locationHistory.length - 1));
  };

  const getCurrentLocation = () => {
    if (
      locationHistory.length === 0 ||
      currentTimeIndex < 0 ||
      currentTimeIndex >= locationHistory.length
    ) {
      return null;
    }
    const location = locationHistory[currentTimeIndex];
    if (!location) {
      console.warn(
        `[TripReplay] No location found at index ${currentTimeIndex}`
      );
      return null;
    }
    return location;
  };

  const getCurrentTime = () => {
    const loc = getCurrentLocation();
    return loc ? loc.timestamp : new Date();
  };

  const getProgressPercentage = () => {
    if (locationHistory.length === 0) return 0;
    if (locationHistory.length === 1) return 100;
    const percentage = (currentTimeIndex / (locationHistory.length - 1)) * 100;
    // Ensure we return a valid number, not NaN or Infinity
    return isNaN(percentage) || !isFinite(percentage) ? 0 : percentage;
  };

  const getDisplayedRoute = () => {
    if (currentTimeIndex === 0) return [];
    return locationHistory
      .slice(0, currentTimeIndex + 1)
      .map((loc) => ({
        lat: loc.latitude,
        lng: loc.longitude,
      }))
      .filter(
        (p) =>
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          !isNaN(p.lat) &&
          !isNaN(p.lng) &&
          isFinite(p.lat) &&
          isFinite(p.lng)
      );
  };

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
        <LoadingSpinner size="lg" text="Loading trip replay..." />
      </div>
    );
  }

  if (locationHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600">
            No location history available for this trip
          </p>
        </div>
      </div>
    );
  }

  const currentLocation = getCurrentLocation();
  const displayedRoute = getDisplayedRoute();

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Trip Replay</h2>
            <p className="text-sm text-gray-500">
              {getCurrentTime().toLocaleString()}
            </p>
            {isInterpolated && (
              <p className="text-xs text-blue-600 mt-1">
                <span className="font-semibold">Note:</span> Location data has
                been interpolated for smoother animation
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRewind}
              className="p-2 bg-gray-100 rounded hover:bg-gray-200"
              title="Rewind to start"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
            <button
              onClick={handlePlayPause}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseIcon className="h-5 w-5" />
              ) : (
                <PlayIcon className="h-5 w-5" />
              )}
            </button>
            <select
              value={playbackSpeed}
              onChange={(e) => {
                setPlaybackSpeed(Number(e.target.value));
              }}
              className="px-3 py-2 border border-gray-300 rounded"
            >
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="100"
            value={getProgressPercentage()}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{locationHistory[0]?.timestamp.toLocaleTimeString()}</span>
            <span>
              {locationHistory[
                locationHistory.length - 1
              ]?.timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Timeline Events */}
        {timelineEvents.length > 0 && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {timelineEvents.map((event, index) => {
              const eventProgress =
                (locationHistory.findIndex(
                  (loc) => loc.timestamp >= event.timestamp
                ) /
                  locationHistory.length) *
                100;

              return (
                <div
                  key={index}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded"
                  style={{ marginLeft: `${eventProgress}%` }}
                  title={event.description}
                >
                  {event.type === "checkpoint" ? "✓" : "⚠"}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Warning Banner */}
      {locationWarning && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{locationWarning}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Panel */}
      {currentLocation && (
        <div className="bg-gray-50 border-b p-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Speed: </span>
              <span className="font-semibold">
                {currentLocation.speed
                  ? `${currentLocation.speed.toFixed(1)} km/h`
                  : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Progress: </span>
              <span className="font-semibold">
                {getProgressPercentage().toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-500">Location: </span>
              <span className="font-semibold">
                {currentTimeIndex + 1} / {locationHistory.length}
              </span>
              {isInterpolated && (
                <span className="text-xs text-blue-600 ml-1">
                  (interpolated)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

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
                strokeOpacity: 0.4,
                strokeWeight: 3,
                zIndex: 1,
              }}
            />
          )}

          {/* Actual Route (up to current time) */}
          {displayedRoute.length > 1 && (
            <Polyline
              path={displayedRoute}
              options={{
                strokeColor: "#10B981",
                strokeOpacity: 0.8,
                strokeWeight: 3,
                zIndex: 2,
              }}
            />
          )}

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
            .map((checkpoint) => {
              const isReached =
                currentLocation &&
                currentLocation.isCheckpointReached &&
                currentLocation.checkpointIndex === checkpoint.order;
              const willBeReached = locationHistory.some(
                (loc) =>
                  loc.checkpointIndex === checkpoint.order &&
                  loc.timestamp > getCurrentTime()
              );

              return (
                <Marker
                  key={checkpoint.id}
                  position={{
                    lat: checkpoint.latitude,
                    lng: checkpoint.longitude,
                  }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: isReached ? 10 : 6,
                    fillColor: isReached
                      ? "#10B981"
                      : willBeReached
                      ? "#3B82F6"
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

          {/* Current Position */}
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
                  fillColor: currentLocation.isRouteDeviation
                    ? "#EF4444"
                    : "#10B981",
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 3,
                }}
                title={`${getCurrentTime().toLocaleTimeString()}`}
              />
            )}
        </GoogleMap>
      </div>
    </div>
  );
}
