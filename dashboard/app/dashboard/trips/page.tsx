"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function ScheduledTripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<ScheduledTrip[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      if (statusFilter) params.append("status", statusFilter);

      const response = await api.get(`/admin/trips?${params}`);
      setTrips(response.data.trips);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error("Error fetching scheduled trips:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this trip?")) {
      return;
    }

    try {
      await api.delete(`/admin/trips/${id}`);
      fetchTrips();
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Scheduled Trips</h1>
        <button
          onClick={() => router.push("/dashboard/trips/create")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Create Trip
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="FAILED">Failed</option>
            <option value="EMERGENCY_TERMINATED">Emergency Terminated</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trip Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Captain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Checkpoints
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {trips.length > 0 ? (
                    trips.map((trip) => (
                      <tr key={trip.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {trip.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{new Date(trip.tripDate).toLocaleDateString()}</div>
                          <div className="text-xs">
                            {new Date(trip.scheduledTime).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {trip.assignedCaptain?.name || <span className="text-gray-500 italic">Not assigned</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {trip.points?.length || 0} point(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => router.push(`/dashboard/trips/${trip.id}`)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            View
                          </button>
                          {(trip.status === "SCHEDULED" || trip.status === "FAILED") && (
                            <>
                              <button
                                onClick={() => router.push(`/dashboard/trips/${trip.id}/edit`)}
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(trip.id)}
                                className="text-red-600 hover:text-red-900 font-medium"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No scheduled trips found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((page - 1) * pagination.limit) + 1} to{" "}
                  {Math.min(page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

