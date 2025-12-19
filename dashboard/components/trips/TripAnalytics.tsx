"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TripAnalyticsProps {
  tripId: string;
}

interface AnalyticsData {
  averageSpeed: number;
  maxSpeed: number;
  totalIdleTime: number;
  idleSegments: Array<{
    start: Date;
    end: Date;
    duration: number;
  }>;
  checkpointTimings: Array<{
    checkpointIndex: number;
    checkpointName: string;
    expectedTime: string | null;
    reachedAt: string | null;
    delayMinutes: number | null;
  }>;
  routeAdherence: number;
  totalDistance: number;
}

export default function TripAnalytics({ tripId }: TripAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [speedData, setSpeedData] = useState<any[]>([]);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch analytics
        const analyticsResponse = await api.get(
          `/admin/trips/${tripId}/analytics`
        );
        setAnalytics(analyticsResponse.data.analytics);

        // Fetch location history for speed chart
        const historyResponse = await api.get(
          `/admin/trips/${tripId}/location-history?limit=1000`
        );
        const locations = historyResponse.data.locationHistory;

        setLocationHistory(locations);

        // Prepare speed data for chart
        const speedChartData = locations.map((loc: any) => ({
          time: new Date(loc.timestamp).toLocaleTimeString(),
          speed: loc.speed || 0,
          timestamp: new Date(loc.timestamp).getTime(),
        }));

        setSpeedData(speedChartData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching analytics:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [tripId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading analytics..." />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600">No analytics data available</p>
        </div>
      </div>
    );
  }

  // Prepare checkpoint timing data for chart
  const checkpointData = analytics.checkpointTimings.map((timing) => ({
    name: timing.checkpointName,
    expected: timing.expectedTime
      ? new Date(timing.expectedTime).getHours() * 60 +
        new Date(timing.expectedTime).getMinutes()
      : null,
    actual: timing.reachedAt
      ? new Date(timing.reachedAt).getHours() * 60 +
        new Date(timing.reachedAt).getMinutes()
      : null,
    delay: timing.delayMinutes,
  }));

  // Prepare route adherence data
  const adherenceData = [
    { name: "On Route", value: analytics.routeAdherence },
    { name: "Deviated", value: 100 - analytics.routeAdherence },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent>
            <div className="text-sm text-gray-500">Average Speed</div>
            <div className="text-2xl font-semibold">
              {analytics.averageSpeed.toFixed(1)} km/h
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-gray-500">Max Speed</div>
            <div className="text-2xl font-semibold">
              {analytics.maxSpeed.toFixed(1)} km/h
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-gray-500">Total Idle Time</div>
            <div className="text-2xl font-semibold">
              {analytics.totalIdleTime.toFixed(1)} min
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-gray-500">Route Adherence</div>
            <div className="text-2xl font-semibold">
              {analytics.routeAdherence.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-gray-500">Total Distance</div>
            <div className="text-2xl font-semibold">
              {(analytics.totalDistance / 1000).toFixed(2)} km
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Speed Chart */}
      {speedData.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Speed Over Time</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={speedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  label={{
                    value: "Speed (km/h)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="speed"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Speed (km/h)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Checkpoint Timing Comparison */}
      {analytics.checkpointTimings.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Checkpoint Timing</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={checkpointData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis
                  label={{
                    value: "Time (minutes)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="expected" fill="#3B82F6" name="Expected" />
                <Bar dataKey="actual" fill="#10B981" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Idle Time Breakdown */}
      {analytics.idleSegments.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Idle Time Segments</h3>
          </CardHeader>
          <CardContent>
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.idleSegments.map((segment, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(segment.start).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(segment.end).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {segment.duration.toFixed(1)} minutes
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checkpoint Timing Details */}
      {analytics.checkpointTimings.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Checkpoint Details</h3>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Checkpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Expected Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actual Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Delay
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.checkpointTimings.map((timing, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {timing.checkpointName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {timing.expectedTime
                          ? new Date(timing.expectedTime).toLocaleString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {timing.reachedAt
                          ? new Date(timing.reachedAt).toLocaleString()
                          : "Not reached"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {timing.delayMinutes !== null ? (
                          <span
                            className={
                              timing.delayMinutes > 0
                                ? "text-red-600 font-semibold"
                                : "text-green-600"
                            }
                          >
                            {timing.delayMinutes > 0 ? "+" : ""}
                            {timing.delayMinutes.toFixed(1)} min
                          </span>
                        ) : (
                          "N/A"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
