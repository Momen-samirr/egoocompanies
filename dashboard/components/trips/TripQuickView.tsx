"use client";

import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { ScheduledTrip } from "@/types/trip";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import TripTimeline from "./TripTimeline";

interface TripQuickViewProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export default function TripQuickView({
  tripId,
  isOpen,
  onClose,
  onEdit,
}: TripQuickViewProps) {
  const router = useRouter();
  const [trip, setTrip] = useState<ScheduledTrip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && tripId) {
      fetchTrip();
    }
  }, [isOpen, tripId]);

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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-xl z-50 overflow-y-auto">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-semibold text-gray-900">
              {trip?.name || "Trip Details"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" text="Loading trip details..." />
              </div>
            ) : !trip ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Trip not found</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Status
                  </label>
                  <StatusBadge status={trip.status} />
                </div>

                {/* Trip Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Trip Date
                    </label>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(trip.tripDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Scheduled Time
                    </label>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(trip.scheduledTime).toLocaleTimeString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(trip.scheduledTime), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>

                {/* Captain */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Assigned Captain
                  </label>
                  {trip.assignedCaptain ? (
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {trip.assignedCaptain.name}
                      </p>
                      <p className="text-xs text-gray-500">{trip.assignedCaptain.phone_number}</p>
                      <p className="text-xs text-gray-500">{trip.assignedCaptain.email}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No captain assigned</p>
                  )}
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Company
                  </label>
                  <p className="text-sm font-semibold text-gray-900">
                    {trip.company?.name || "Not specified"}
                  </p>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Price
                  </label>
                  <p className="text-sm font-semibold text-gray-900">
                    ${trip.price?.toFixed(2) || "0.00"}
                  </p>
                </div>

                {/* Checkpoints */}
                {trip.points && trip.points.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      Checkpoints ({trip.points.length})
                    </label>
                    <TripTimeline
                      checkpoints={trip.points}
                      currentPointIndex={trip.progress?.currentPointIndex}
                      status={trip.status}
                      tripType={trip.tripType}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {trip && (
            <div className="flex gap-3 justify-end p-6 border-t border-gray-200 sticky bottom-0 bg-white">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              {onEdit && (
                <Button
                  variant="primary"
                  onClick={() => {
                    onEdit();
                    onClose();
                  }}
                >
                  Edit Trip
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => {
                  router.push(`/dashboard/trips/${tripId}`);
                  onClose();
                }}
              >
                View Full Details
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

