"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import Card, { CardHeader, CardBody } from "@/components/common/Card";
import StatusBadge from "@/components/common/StatusBadge";
import Button from "@/components/common/Button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import TripTimeline from "@/components/trips/TripTimeline";
import { PencilIcon, TrashIcon, ArrowLeftIcon, UserIcon } from "@heroicons/react/24/outline";

interface ScheduledTrip {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  status:
    | "SCHEDULED"
    | "ACTIVE"
    | "COMPLETED"
    | "CANCELLED"
    | "FAILED"
    | "EMERGENCY_TERMINATED"
    | "EMERGENCY_ENDED";
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
  company: {
    id: string;
    name: string;
    defaultScheduledTripPrice: number;
  };
  companyId: string;
  price: number;
  financialRule?: "NONE" | "COMPLETED_FULL" | "FAILED_DOUBLE" | "EMERGENCY_DEDUCTION";
  financialAdjustment?: number;
  netAmount?: number;
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


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading trip details..." />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Trip not found</div>
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
            onClick={() => router.push("/dashboard/trips")}
          >
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{trip.name}</h1>
            <p className="text-gray-500 mt-1">
              Created by {trip.createdBy.name} on{" "}
              {new Date(trip.tripDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(trip.status === "SCHEDULED" || trip.status === "FAILED") && (
            <>
              <Button
                variant="secondary"
                icon={PencilIcon}
                onClick={() => router.push(`/dashboard/trips/${tripId}/edit`)}
              >
                Edit Trip
              </Button>
              {!trip.assignedCaptain && (
                <Button
                  icon={UserIcon}
                  onClick={() => router.push(`/dashboard/trips/${tripId}/edit`)}
                >
                  Assign Captain
                </Button>
              )}
              <Button
                variant="danger"
                icon={TrashIcon}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trip Information */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Trip Information</h2>
          </CardHeader>
          <CardBody>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={trip.status} />
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Trip Date</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {new Date(trip.tripDate).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Scheduled Time</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {new Date(trip.scheduledTime).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Assigned Captain</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {trip.assignedCaptain ? (
                    <div className="space-y-1">
                      <div className="font-medium">{trip.assignedCaptain.name}</div>
                      <div className="text-gray-500">{trip.assignedCaptain.phone_number}</div>
                      <div className="text-gray-500">{trip.assignedCaptain.vehicle_type}</div>
                    </div>
                  ) : (
                    <span className="text-gray-500 italic">No captain assigned yet</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Company</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {trip.company?.name || "Not specified"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Trip Price</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  ${trip.price.toFixed(2)}
                </dd>
              </div>
              {trip.progress && (
                <>
                  {trip.progress.startedAt && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Started At</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900">
                        {new Date(trip.progress.startedAt).toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {trip.progress.completedAt && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Completed At</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900">
                        {new Date(trip.progress.completedAt).toLocaleString()}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Current Checkpoint</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">
                      {trip.progress.currentPointIndex + 1} of {trip.points.length}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </CardBody>
        </Card>

        {/* Checkpoints Timeline */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Checkpoints</h2>
          </CardHeader>
          <CardBody>
            <TripTimeline
              checkpoints={trip.points}
              currentPointIndex={trip.progress?.currentPointIndex}
              status={trip.status}
            />
          </CardBody>
        </Card>
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

