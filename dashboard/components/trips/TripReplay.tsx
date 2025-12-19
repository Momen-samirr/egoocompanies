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

  const mapRef = useRef<google.maps.Map | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
          const route = trip.points.map((p: any) => ({
            lat: p.latitude,
            lng: p.longitude,
          }));
          setPlannedRoute(route);
          setCheckpoints(trip.points);
        }

        // Fetch location history
        const historyResponse = await api.get(
          `/admin/trips/${tripId}/location-history?limit=1000`
        );
        const locations = historyResponse.data.locationHistory.map(
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

        setLocationHistory(locations);

        // Build timeline events
        const events: TimelineEvent[] = [];
        locations.forEach((loc: LocationPoint, index: number) => {
          if (loc.isCheckpointReached && loc.checkpointIndex !== null) {
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
            !locations[index - 1].isRouteDeviation
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

  // Playback control
  useEffect(() => {
    if (isPlaying && locationHistory.length > 0) {
      const interval = 1000 / playbackSpeed; // Adjust interval based on speed
      playbackIntervalRef.current = setInterval(() => {
        setCurrentTimeIndex((prev) => {
          if (prev >= locationHistory.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, locationHistory.length]);

  // Update map when time index changes
  useEffect(() => {
    if (
      isLoaded &&
      mapRef.current &&
      locationHistory.length > 0 &&
      currentTimeIndex < locationHistory.length
    ) {
      const currentLocation = locationHistory[currentTimeIndex];
      mapRef.current.setCenter({
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
      });
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
        bounds.extend(new google.maps.LatLng(point.lat, point.lng));
      });

      if (locationHistory.length > 0) {
        locationHistory.forEach((loc) => {
          bounds.extend(new google.maps.LatLng(loc.latitude, loc.longitude));
        });
      }

      if (bounds.getNorthEast() && bounds.getSouthWest()) {
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [isLoaded, plannedRoute, locationHistory]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
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
      currentTimeIndex >= locationHistory.length
    ) {
      return null;
    }
    return locationHistory[currentTimeIndex];
  };

  const getCurrentTime = () => {
    const loc = getCurrentLocation();
    return loc ? loc.timestamp : new Date();
  };

  const getProgressPercentage = () => {
    if (locationHistory.length === 0) return 0;
    return (currentTimeIndex / (locationHistory.length - 1)) * 100;
  };

  const getDisplayedRoute = () => {
    if (currentTimeIndex === 0) return [];
    return locationHistory.slice(0, currentTimeIndex + 1).map((loc) => ({
      lat: loc.latitude,
      lng: loc.longitude,
    }));
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
          {checkpoints.map((checkpoint) => {
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
          {currentLocation && (
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
