"use client";

import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/common/Button";
import FormField from "@/components/common/FormField";
import { ScheduledTrip } from "@/types/trip";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TripEditModalProps {
  trip: ScheduledTrip;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Driver {
  id: string;
  name: string;
  phone_number: string;
  email: string;
}

interface Company {
  id: string;
  name: string;
}

export default function TripEditModal({
  trip,
  isOpen,
  onClose,
  onSuccess,
}: TripEditModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: trip.name,
    tripDate: trip.tripDate.split("T")[0],
    scheduledTime: new Date(trip.scheduledTime).toTimeString().slice(0, 5),
    assignedCaptainId: trip.assignedCaptainId || "",
    companyId: trip.companyId || "",
    price: trip.price || 0,
  });
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchDrivers();
      fetchCompanies();
    }
  }, [isOpen]);

  const fetchDrivers = async () => {
    try {
      const response = await api.get("/admin/drivers");
      setDrivers(response.data.drivers || []);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await api.get("/admin/companies");
      setCompanies(response.data.companies || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

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
      const scheduledTimeWithTimezone = `${formData.scheduledTime}:00${timezoneString}`;

      const response = await api.put(`/admin/trips/${trip.id}`, {
        name: formData.name,
        tripDate: formData.tripDate,
        scheduledTime: scheduledTimeWithTimezone,
        assignedCaptainId: formData.assignedCaptainId || undefined,
        companyId: formData.companyId,
        price: formData.price,
      });

      if (response.data.success) {
        toast.success("Trip updated successfully");
        queryClient.invalidateQueries({ queryKey: ["trips"] });
        onSuccess?.();
        onClose();
      } else {
        toast.error(response.data.message || "Failed to update trip");
      }
    } catch (error: any) {
      console.error("Error updating trip:", error);
      toast.error(
        error.response?.data?.message || "Failed to update trip"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-900">Edit Trip</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={isSubmitting}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <FormField label="Trip Name" required>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                required
                disabled={isSubmitting}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Trip Date" required>
                <input
                  type="date"
                  value={formData.tripDate}
                  onChange={(e) => setFormData({ ...formData, tripDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  required
                  disabled={isSubmitting}
                />
              </FormField>

              <FormField label="Scheduled Time" required>
                <input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  required
                  disabled={isSubmitting}
                />
              </FormField>
            </div>

            <FormField label="Company" required>
              <select
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                required
                disabled={isSubmitting || loading}
              >
                <option value="">Select a company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Assigned Captain">
              <select
                value={formData.assignedCaptainId}
                onChange={(e) =>
                  setFormData({ ...formData, assignedCaptainId: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                disabled={isSubmitting || loading}
              >
                <option value="">No captain assigned</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} ({driver.phone_number})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Price" required>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                required
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          <div className="flex gap-3 justify-end p-6 border-t border-gray-200 sticky bottom-0 bg-white">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

