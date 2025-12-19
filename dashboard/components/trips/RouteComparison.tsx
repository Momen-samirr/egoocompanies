"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";
import api from "@/lib/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import Card, { CardHeader, CardBody } from "@/components/common/Card";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const libraries: ("drawing" | "geometry" | "places" | "visualization")[] = [
  "places",
];

interface RouteComparisonProps {
  tripId: string;
}

interface RouteAnalysis {
  plannedRoute: Array<{ lat: number; lng: number }>;
  actualPath: Array<{ lat: number; lng: number }>;
  plannedDistance: number;
  actualDistance: number;
  routeEfficiency: number;
  deviationSegments: Array<{
    start: { latitude: number; longitude: number; timestamp: Date };
    end: { latitude: number; longitude: number; timestamp: Date };
    maxDeviation: number;
    duration: number;
  }>;
  statistics: {
    totalDeviationDistance: number;
    averageDeviation: number;
    largestDeviation: number;
    deviationCount: number;
  };
}

export default function RouteComparison({ tripId }: RouteComparisonProps) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey,
    libraries: libraries,
  });

  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"overlay" | "side-by-side">(
    "overlay"
  );
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/trips/${tripId}/route-analysis`);
        setAnalysis(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching route analysis:", error);
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [tripId]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Auto-fit map to show both routes
  useEffect(() => {
    if (
      isLoaded &&
      mapRef.current &&
      analysis &&
      analysis.plannedRoute.length > 0
    ) {
      const bounds = new google.maps.LatLngBounds();

      analysis.plannedRoute.forEach((point) => {
        bounds.extend(new google.maps.LatLng(point.lat, point.lng));
      });

      analysis.actualPath.forEach((point) => {
        bounds.extend(new google.maps.LatLng(point.lat, point.lng));
      });

      if (bounds.getNorthEast() && bounds.getSouthWest()) {
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [isLoaded, analysis]);

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
        <LoadingSpinner size="lg" text="Loading route analysis..." />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600">No route analysis available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="text-sm text-gray-500">Planned Distance</div>
            <div className="text-2xl font-semibold">
              {(analysis.plannedDistance / 1000).toFixed(2)} km
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-gray-500">Actual Distance</div>
            <div className="text-2xl font-semibold">
              {(analysis.actualDistance / 1000).toFixed(2)} km
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-gray-500">Route Efficiency</div>
            <div className="text-2xl font-semibold">
              {analysis.routeEfficiency.toFixed(1)}%
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-gray-500">Largest Deviation</div>
            <div className="text-2xl font-semibold">
              {(analysis.statistics.largestDeviation / 1000).toFixed(2)} km
            </div>
          </CardBody>
        </Card>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">View Mode:</span>
        <button
          onClick={() => setViewMode("overlay")}
          className={`px-4 py-2 rounded ${
            viewMode === "overlay"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Overlay
        </button>
        <button
          onClick={() => setViewMode("side-by-side")}
          className={`px-4 py-2 rounded ${
            viewMode === "side-by-side"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Side by Side
        </button>
      </div>

      {/* Map */}
      <div className="h-[600px] relative">
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
          {analysis.plannedRoute.length > 1 && (
            <Polyline
              path={analysis.plannedRoute}
              options={{
                strokeColor: "#3B82F6",
                strokeOpacity: 0.6,
                strokeWeight: 4,
                zIndex: 1,
              }}
            />
          )}

          {/* Actual Route */}
          {analysis.actualPath.length > 1 && (
            <Polyline
              path={analysis.actualPath}
              options={{
                strokeColor: "#10B981",
                strokeOpacity: 0.8,
                strokeWeight: 3,
                zIndex: 2,
              }}
            />
          )}

          {/* Deviation Segments */}
          {analysis.deviationSegments.map((segment, index) => (
            <Polyline
              key={`deviation-${index}`}
              path={[
                { lat: segment.start.latitude, lng: segment.start.longitude },
                { lat: segment.end.latitude, lng: segment.end.longitude },
              ]}
              options={{
                strokeColor: "#EF4444",
                strokeOpacity: 0.8,
                strokeWeight: 5,
                zIndex: 3,
              }}
              onClick={() => setSelectedSegment(index)}
            />
          ))}

          {/* Deviation Segment Info Windows */}
          {selectedSegment !== null &&
            analysis.deviationSegments[selectedSegment] && (
              <InfoWindow
                position={{
                  lat:
                    (analysis.deviationSegments[selectedSegment].start
                      .latitude +
                      analysis.deviationSegments[selectedSegment].end
                        .latitude) /
                    2,
                  lng:
                    (analysis.deviationSegments[selectedSegment].start
                      .longitude +
                      analysis.deviationSegments[selectedSegment].end
                        .longitude) /
                    2,
                }}
                onCloseClick={() => setSelectedSegment(null)}
              >
                <div className="p-2">
                  <h3 className="font-semibold">Route Deviation</h3>
                  <p className="text-sm">
                    Max Deviation:{" "}
                    {(
                      analysis.deviationSegments[selectedSegment].maxDeviation /
                      1000
                    ).toFixed(2)}{" "}
                    km
                  </p>
                  <p className="text-sm">
                    Duration:{" "}
                    {analysis.deviationSegments[
                      selectedSegment
                    ].duration.toFixed(1)}{" "}
                    minutes
                  </p>
                </div>
              </InfoWindow>
            )}
        </GoogleMap>
      </div>

      {/* Deviation Details */}
      {analysis.deviationSegments.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Deviation Segments</h3>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Start Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      End Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Max Deviation
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analysis.deviationSegments.map((segment, index) => (
                    <tr
                      key={index}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedSegment(index)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(segment.start.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(segment.end.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {segment.duration.toFixed(1)} minutes
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(segment.maxDeviation / 1000).toFixed(2)} km
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
