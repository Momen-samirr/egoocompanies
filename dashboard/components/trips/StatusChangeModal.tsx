"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/common/Button";
import FormField from "@/components/common/FormField";
import { ScheduledTripStatus } from "@/types/trip";
import api from "@/lib/api";
import { toast } from "react-hot-toast";

interface StatusChangeModalProps {
  trip: {
    id: string;
    name: string;
    status: ScheduledTripStatus;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const statusOptions: { value: ScheduledTripStatus; label: string }[] = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "FAILED", label: "Failed" },
  { value: "EMERGENCY_TERMINATED", label: "Emergency Terminated" },
  { value: "EMERGENCY_ENDED", label: "Emergency Ended" },
  { value: "FORCE_CLOSED", label: "Force Closed" },
];

export default function StatusChangeModal({
  trip,
  isOpen,
  onClose,
  onSuccess,
}: StatusChangeModalProps) {
  const [newStatus, setNewStatus] = useState<ScheduledTripStatus>(trip.status);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newStatus === trip.status) {
      toast.error("Please select a different status");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.put(`/admin/trips/${trip.id}/status`, {
        newStatus,
        note: note.trim() || undefined,
      });

      if (response.data.success) {
        toast.success(
          `Trip status changed from ${trip.status} to ${newStatus}`
        );
        onSuccess();
        onClose();
        setNote("");
      } else {
        toast.error(response.data.message || "Failed to change status");
      }
    } catch (error: any) {
      console.error("Error changing trip status:", error);
      toast.error(
        error.response?.data?.message || "Failed to change trip status"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setNote("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Change Trip Status
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={isSubmitting}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Trip:</span> {trip.name}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Current Status:</span>{" "}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {trip.status}
                </span>
              </p>
            </div>

            <FormField label="New Status" required>
              <select
                value={newStatus}
                onChange={(e) =>
                  setNewStatus(e.target.value as ScheduledTripStatus)
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                disabled={isSubmitting}
                required
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Note"
              hint="Optional: Add a note about this status change"
            >
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Enter a note about this status change..."
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white resize-none"
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          <div className="flex gap-3 justify-end p-6 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? "Changing..." : "Change Status"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

