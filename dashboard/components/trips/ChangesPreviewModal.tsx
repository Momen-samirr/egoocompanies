"use client";

import { useState } from "react";
import { XMarkIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { TripChanges } from "./MultiEditModal";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ChangesPreviewModalProps {
  changes: TripChanges;
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  onSaveSuccess?: () => void;
}

export default function ChangesPreviewModal({
  changes,
  isOpen,
  onClose,
  onBack,
  onSaveSuccess,
}: ChangesPreviewModalProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<{
    succeeded: string[];
    failed: { tripId: string; error: string }[];
  } | null>(null);

  const tripIds = Object.keys(changes);
  const totalChanges = tripIds.reduce(
    (sum, id) => sum + Object.keys(changes[id].fields).length,
    0
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSaveResults(null);

    const succeeded: string[] = [];
    const failed: { tripId: string; error: string }[] = [];

    for (const tripId of tripIds) {
      const change = changes[tripId];
      const editedFields = change.fields;

      try {
        // Get timezone offset for time preservation
        const now = new Date();
        const timezoneOffset = -now.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
        const offsetMinutes = Math.abs(timezoneOffset) % 60;
        const offsetSign = timezoneOffset >= 0 ? "+" : "-";
        const timezoneString = `${offsetSign}${String(offsetHours).padStart(
          2,
          "0"
        )}:${String(offsetMinutes).padStart(2, "0")}`;

        // Build update payload - only include changed fields
        const updatePayload: any = {};

        if (editedFields.name) {
          updatePayload.name = editedFields.name.after;
        }
        if (editedFields.tripDate) {
          updatePayload.tripDate = editedFields.tripDate.after;
        }
        if (editedFields.scheduledTime) {
          const scheduledTimeWithTimezone = `${editedFields.scheduledTime.after}:00${timezoneString}`;
          updatePayload.scheduledTime = scheduledTimeWithTimezone;
        }
        if (editedFields.companyId) {
          // Use the stored ID, not the display value
          const afterId = editedFields.companyId.afterId;
          updatePayload.companyId = afterId || undefined;
        }
        if (editedFields.assignedCaptainId) {
          // Use the stored ID, not the display value
          const afterId = editedFields.assignedCaptainId.afterId;
          updatePayload.assignedCaptainId = afterId || undefined;
        }
        if (editedFields.price) {
          updatePayload.price = editedFields.price.after;
        }

        const response = await api.put(`/admin/trips/${tripId}`, updatePayload);

        if (response.data.success) {
          succeeded.push(tripId);
        } else {
          failed.push({
            tripId,
            error: response.data.message || "Failed to update trip",
          });
        }
      } catch (error: any) {
        failed.push({
          tripId,
          error:
            error.response?.data?.message || "Failed to update trip",
        });
      }
    }

    setSaveResults({ succeeded, failed });
    setIsSaving(false);

    if (failed.length === 0) {
      toast.success(`Successfully updated ${succeeded.length} trip${succeeded.length !== 1 ? "s" : ""}`);
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      onSaveSuccess?.();
      onClose();
    } else if (succeeded.length > 0) {
      toast.error(
        `Updated ${succeeded.length} trip${succeeded.length !== 1 ? "s" : ""}, but ${failed.length} failed`
      );
    } else {
      toast.error("Failed to update all trips");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Review Changes
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {totalChanges} change{totalChanges !== 1 ? "s" : ""} across{" "}
              {tripIds.length} trip{tripIds.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={isSaving}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {tripIds.map((tripId) => {
              const change = changes[tripId];
              const fieldKeys = Object.keys(change.fields);

              if (fieldKeys.length === 0) return null;

              return (
                <div
                  key={tripId}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <h4 className="font-semibold text-gray-900 mb-3">
                    {change.tripName}
                  </h4>
                  <div className="space-y-2">
                    {fieldKeys.map((fieldKey) => {
                      const fieldChange = change.fields[fieldKey];
                      const fieldLabels: { [key: string]: string } = {
                        name: "Trip Name",
                        tripDate: "Trip Date",
                        scheduledTime: "Scheduled Time",
                        companyId: "Company",
                        assignedCaptainId: "Assigned Captain",
                        price: "Price",
                      };

                      return (
                        <div
                          key={fieldKey}
                          className="flex items-start gap-3 p-2 bg-gray-50 rounded"
                        >
                          <div className="flex-1">
                            <div className="text-xs font-medium text-gray-600 mb-1">
                              {fieldLabels[fieldKey] || fieldKey}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700 line-through">
                                {typeof fieldChange.before === "number"
                                  ? `$${fieldChange.before.toFixed(2)}`
                                  : String(fieldChange.before)}
                              </span>
                              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-semibold text-indigo-600">
                                {typeof fieldChange.after === "number"
                                  ? `$${fieldChange.after.toFixed(2)}`
                                  : String(fieldChange.after)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {saveResults && saveResults.failed.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h5 className="font-semibold text-red-900 mb-2">
                Failed Updates ({saveResults.failed.length})
              </h5>
              <ul className="space-y-1">
                {saveResults.failed.map((failure) => (
                  <li key={failure.tripId} className="text-sm text-red-700">
                    <strong>{changes[failure.tripId]?.tripName}:</strong>{" "}
                    {failure.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-between items-center p-6 border-t border-gray-200 sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onBack} disabled={isSaving}>
            Back to Edit
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleSave}
              disabled={isSaving}
              loading={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

