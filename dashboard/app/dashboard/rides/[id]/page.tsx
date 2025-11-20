"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { Ride } from "@/types";

export default function RideDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchRide();
    }
  }, [params.id]);

  const fetchRide = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/rides/${params.id}`);
      setRide(response.data.ride);
    } catch (error) {
      console.error("Error fetching ride:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading...</div>;
  }

  if (!ride) {
    return <div className="text-center py-8 text-red-600">Ride not found</div>;
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
        <h1 className="text-3xl font-bold text-gray-900">Ride Details</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Ride Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Ride ID</dt>
            <dd className="mt-1 text-sm text-gray-900">{ride.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
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
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Pickup Location</dt>
            <dd className="mt-1 text-sm text-gray-900">{ride.currentLocationName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Destination</dt>
            <dd className="mt-1 text-sm text-gray-900">{ride.destinationLocationName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Distance</dt>
            <dd className="mt-1 text-sm text-gray-900">{ride.distance}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Charge</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">
              ${ride.charge.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Rating</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {ride.rating ? `${ride.rating.toFixed(1)} ⭐` : "Not rated"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(ride.cratedAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ride.user && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">User Information</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{ride.user.name || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Phone</dt>
                <dd className="mt-1 text-sm text-gray-900">{ride.user.phone_number}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{ride.user.email || "N/A"}</dd>
              </div>
            </dl>
          </div>
        )}

        {ride.driver && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Driver Information</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{ride.driver.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Phone</dt>
                <dd className="mt-1 text-sm text-gray-900">{ride.driver.phone_number}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Vehicle Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{ride.driver.vehicle_type}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

