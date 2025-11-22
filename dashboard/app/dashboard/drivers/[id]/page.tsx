"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { Driver, Ride } from "@/types";
import Card, { CardHeader, CardBody } from "@/components/common/Card";
import StatusBadge from "@/components/common/StatusBadge";
import Button from "@/components/common/Button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

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
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading driver details..." />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Driver not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeftIcon}
            onClick={() => router.back()}
          >
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Driver Details</h1>
        </div>
        {driver.status === "inactive" && (
          <Button
            icon={CheckCircleIcon}
            onClick={() => handleVerify(true)}
          >
            Verify Driver
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">{driver.name}</dd>
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
              <dd className="mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {driver.vehicle_type}
                </span>
              </dd>
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
                <StatusBadge status={driver.status} />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Rides</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">{driver.totalRides}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Earnings</dt>
              <dd className="mt-1 text-lg font-bold text-gray-900">
                ${driver.totalEarning.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Rating</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <span className="inline-flex items-center">
                  {driver.ratings.toFixed(1)}
                  <svg className="h-4 w-4 text-yellow-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </span>
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {driver.rides && driver.rides.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Ride History</h2>
          </CardHeader>
          <CardBody padding="none">
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
                    <tr key={ride.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(ride.cratedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {ride.user?.name || ride.user?.phone_number || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="font-medium">{ride.currentLocationName}</div>
                        <div className="text-xs text-gray-400">→ {ride.destinationLocationName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${ride.charge.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={ride.status} size="sm" />
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

