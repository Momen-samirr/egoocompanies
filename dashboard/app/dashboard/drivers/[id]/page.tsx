"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { Driver, Ride } from "@/types";

export default function DriverDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchDriver();
    }
  }, [params.id]);

  const fetchDriver = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/drivers/${params.id}`);
      setDriver(response.data.driver);
    } catch (error) {
      console.error("Error fetching driver:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (verified: boolean) => {
    try {
      await api.put(`/admin/drivers/${params.id}/verify`, { verified });
      fetchDriver();
      alert("Driver verification status updated");
    } catch (error) {
      console.error("Error verifying driver:", error);
      alert("Failed to update verification status");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading...</div>;
  }

  if (!driver) {
    return <div className="text-center py-8 text-red-600">Driver not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-indigo-600 hover:text-indigo-900"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Driver Details</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
          {driver.status === "inactive" && (
            <button
              onClick={() => handleVerify(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Verify Driver
            </button>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{driver.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
            <dd className="mt-1 text-sm text-gray-900">{driver.phone_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{driver.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Country</dt>
            <dd className="mt-1 text-sm text-gray-900">{driver.country}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Vehicle Type</dt>
            <dd className="mt-1 text-sm text-gray-900">{driver.vehicle_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Registration Number</dt>
            <dd className="mt-1 text-sm text-gray-900">{driver.registration_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Vehicle Color</dt>
            <dd className="mt-1 text-sm text-gray-900">{driver.vehicle_color || "N/A"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Rate</dt>
            <dd className="mt-1 text-sm text-gray-900">{driver.rate}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  driver.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {driver.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Rides</dt>
            <dd className="mt-1 text-sm text-gray-900">{driver.totalRides}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Earnings</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">
              ${driver.totalEarning.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Rating</dt>
            <dd className="mt-1 text-sm text-gray-900">{driver.ratings.toFixed(1)} ⭐</dd>
          </div>
        </dl>
      </div>

      {driver.rides && driver.rides.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Ride History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Charge
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {driver.rides.map((ride: Ride) => (
                  <tr key={ride.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ride.cratedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ride.user?.name || ride.user?.phone_number || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div>{ride.currentLocationName}</div>
                      <div className="text-xs">→ {ride.destinationLocationName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${ride.charge.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          ride.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : ride.status === "In Progress"
                            ? "bg-blue-100 text-blue-800"
                            : ride.status === "Cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {ride.status}
                      </span>
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

