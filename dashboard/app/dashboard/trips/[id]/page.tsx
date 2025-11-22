"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";

interface ScheduledTrip {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED" | "EMERGENCY_TERMINATED";
  assignedCaptain: {
    id: string;
    name: string;
    phone_number: string;
    email: string;
    vehicle_type: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  points: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    isFinalPoint: boolean;
    reachedAt: string | null;
  }>;
  progress: {
    currentPointIndex: number;
    startedAt: string | null;
    completedAt: string | null;
    lastLocationUpdate: string | null;
  } | null;
  activationChecks: Array<{
    id: string;
    checkedAt: string;
    wasWithinProximity: boolean;
    wasOnTime: boolean;
    activated: boolean;
    distanceToFirstPoint: number | null;
  }>;
}

export default function TripDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<ScheduledTrip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/trips/${tripId}`);
      setTrip(response.data.trip);
    } catch (error) {
      console.error("Error fetching trip:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this trip?")) {
      return;
    }

    try {
      await api.delete(`/admin/trips/${tripId}`);
      router.push("/dashboard/trips");
    } catch (error) {
      console.error("Error deleting trip:", error);
      alert("Failed to delete trip");
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return "bg-yellow-100 text-yellow-800";
      case "ACTIVE":
        return "bg-blue-100 text-blue-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      case "FAILED":
        return "bg-red-200 text-red-900 font-bold border-2 border-red-500";
      case "EMERGENCY_TERMINATED":
        return "bg-orange-200 text-orange-900 font-bold border-2 border-orange-500";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading...</div>;
  }

  if (!trip) {
    return <div className="text-center py-8 text-gray-600">Trip not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{trip.name}</h1>
          <p className="text-gray-500 mt-1">
            Created by {trip.createdBy.name} on{" "}
            {new Date(trip.tripDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {(trip.status === "SCHEDULED" || trip.status === "FAILED") &&
            trip.status !== "EMERGENCY_TERMINATED" && (
            <>
              <button
                onClick={() => router.push(`/dashboard/trips/${tripId}/edit`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Edit Trip
              </button>
              {!trip.assignedCaptain && (
                <button
                  onClick={() => router.push(`/dashboard/trips/${tripId}/edit`)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                >
                  Assign Captain
                </button>
              )}
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
              >
                Delete
              </button>
            </>
          )}
          <button
            onClick={() => router.push("/dashboard/trips")}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-medium"
          >
            Back to Trips
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trip Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Trip Information</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-700">Status</dt>
              <dd className="mt-1">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                    trip.status
                  )}`}
                >
                  {trip.status === "FAILED"
                    ? "Failed"
                    : trip.status === "EMERGENCY_TERMINATED"
                    ? "Emergency Ended"
                    : trip.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700">Trip Date</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {new Date(trip.tripDate).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700">Scheduled Time</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {new Date(trip.scheduledTime).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700">Assigned Captain</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {trip.assignedCaptain ? (
                  <>
                    {trip.assignedCaptain.name}
                    <br />
                    <span className="text-gray-500">{trip.assignedCaptain.phone_number}</span>
                    <br />
                    <span className="text-gray-500">{trip.assignedCaptain.vehicle_type}</span>
                  </>
                ) : (
                  <span className="text-gray-500 italic">No captain assigned yet</span>
                )}
              </dd>
            </div>
            {trip.progress && (
              <>
                {trip.progress.startedAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-700">Started At</dt>
                    <dd className="mt-1 text-sm font-medium text-gray-900">
                      {new Date(trip.progress.startedAt).toLocaleString()}
                    </dd>
                  </div>
                )}
                {trip.progress.completedAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-700">Completed At</dt>
                    <dd className="mt-1 text-sm font-medium text-gray-900">
                      {new Date(trip.progress.completedAt).toLocaleString()}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-700">Current Checkpoint</dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">
                    {trip.progress.currentPointIndex + 1} of {trip.points.length}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>

        {/* Checkpoints */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Checkpoints</h2>
          <div className="space-y-2">
            {trip.points.map((point, index) => (
              <div
                key={point.id}
                className={`p-3 border rounded-lg ${
                  trip.progress &&
                  index === trip.progress.currentPointIndex &&
                  trip.status === "ACTIVE"
                    ? "border-blue-500 bg-blue-50"
                    : point.reachedAt
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {index + 1}. {point.name}
                      </span>
                      {point.isFinalPoint && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                          Final
                        </span>
                      )}
                      {point.reachedAt && (
                        <span className="text-green-600">✓</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                    </div>
                    {point.reachedAt && (
                      <div className="text-xs text-gray-400 mt-1">
                        Reached: {new Date(point.reachedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activation Checks History */}
      {trip.activationChecks && trip.activationChecks.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Activation Check History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Checked At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Within Proximity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    On Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Distance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Activated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trip.activationChecks.map((check) => (
                  <tr key={check.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(check.checkedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {check.wasWithinProximity ? (
                        <span className="text-green-600">✓ Yes</span>
                      ) : (
                        <span className="text-red-600">✗ No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {check.wasOnTime ? (
                        <span className="text-green-600">✓ Yes</span>
                      ) : (
                        <span className="text-red-600">✗ No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {check.distanceToFirstPoint
                        ? `${(check.distanceToFirstPoint / 1000).toFixed(2)} km`
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {check.activated ? (
                        <span className="text-green-600">✓ Yes</span>
                      ) : (
                        <span className="text-gray-400">✗ No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

