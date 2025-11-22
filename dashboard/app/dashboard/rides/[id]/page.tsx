"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { Ride } from "@/types";
import Card, { CardHeader, CardBody } from "@/components/common/Card";
import StatusBadge from "@/components/common/StatusBadge";
import Button from "@/components/common/Button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

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
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading ride details..." />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Ride not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeftIcon}
          onClick={() => router.back()}
        >
          Back
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Ride Details</h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Ride Information</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Ride ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{ride.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <StatusBadge status={ride.status} />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Pickup Location</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">{ride.currentLocationName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Destination</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">{ride.destinationLocationName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Distance</dt>
              <dd className="mt-1 text-sm text-gray-900">{ride.distance}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Charge</dt>
              <dd className="mt-1 text-lg font-bold text-gray-900">
                ${ride.charge.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Rating</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {ride.rating ? (
                  <span className="inline-flex items-center">
                    {ride.rating.toFixed(1)}
                    <svg className="h-4 w-4 text-yellow-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </span>
                ) : (
                  "Not rated"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(ride.cratedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ride.user && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">User Information</h2>
            </CardHeader>
            <CardBody>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{ride.user.name || "N/A"}</dd>
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
            </CardBody>
          </Card>
        )}

        {ride.driver && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">Driver Information</h2>
            </CardHeader>
            <CardBody>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{ride.driver.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{ride.driver.phone_number}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Vehicle Type</dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {ride.driver.vehicle_type}
                    </span>
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

