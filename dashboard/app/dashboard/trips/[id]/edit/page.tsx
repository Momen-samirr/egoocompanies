"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";

interface Driver {
  id: string;
  name: string;
  phone_number: string;
  email: string;
  status: string;
}

interface Checkpoint {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  isFinalPoint: boolean;
}

interface ScheduledTrip {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  assignedCaptainId: string;
  points: Checkpoint[];
}

export default function EditTripPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trip, setTrip] = useState<ScheduledTrip | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    tripDate: "",
    scheduledTime: "",
    assignedCaptainId: "",
  });
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  useEffect(() => {
    fetchTrip();
    fetchDrivers();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/trips/${tripId}`);
      if (response.data.success) {
        const tripData = response.data.trip;
        setTrip(tripData);
        
        // Format date and time for form inputs
        const scheduledDate = new Date(tripData.scheduledTime);
        const dateStr = scheduledDate.toISOString().split("T")[0];
        const timeStr = scheduledDate.toTimeString().slice(0, 5); // HH:MM format
        
        setFormData({
          name: tripData.name,
          tripDate: dateStr,
          scheduledTime: timeStr,
          assignedCaptainId: tripData.assignedCaptainId,
        });
        
        // Set checkpoints with their IDs
        setCheckpoints(
          tripData.points.map((point: any) => ({
            id: point.id,
            name: point.name,
            latitude: point.latitude,
            longitude: point.longitude,
            order: point.order,
            isFinalPoint: point.isFinalPoint,
          }))
        );
      }
    } catch (error: any) {
      console.error("Error fetching trip:", error);
      alert(error.response?.data?.message || "Failed to load trip");
      router.push("/dashboard/trips");
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await api.get("/admin/drivers?limit=100&status=active");
      setDrivers(response.data.drivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckpointChange = (index: number, field: keyof Checkpoint, value: any) => {
    setCheckpoints((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addCheckpoint = () => {
    setCheckpoints((prev) => [
      ...prev,
      { name: "", latitude: 0, longitude: 0, order: prev.length, isFinalPoint: false },
    ]);
  };

  const removeCheckpoint = (index: number) => {
    if (checkpoints.length > 1) {
      setCheckpoints((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        // Reorder remaining checkpoints
        return updated.map((cp, i) => ({ ...cp, order: i }));
      });
    }
  };

  const moveCheckpoint = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === checkpoints.length - 1)
    ) {
      return;
    }

    setCheckpoints((prev) => {
      const updated = [...prev];
      const newIndex = direction === "up" ? index - 1 : index + 1;
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      // Update order
      updated.forEach((cp, i) => {
        cp.order = i;
      });
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.tripDate || !formData.scheduledTime || !formData.assignedCaptainId) {
      alert("Please fill in all required fields");
      return;
    }

    if (checkpoints.length === 0) {
      alert("Please add at least one checkpoint");
      return;
    }

    const hasFinalPoint = checkpoints.some((cp) => cp.isFinalPoint);
    if (!hasFinalPoint) {
      alert("Please mark at least one checkpoint as the final point");
      return;
    }

    // Validate checkpoints
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      if (!cp.name || cp.latitude === 0 || cp.longitude === 0) {
        alert(`Please fill in all fields for checkpoint ${i + 1}`);
        return;
      }
    }

    try {
      setSaving(true);
      
      // Get user's timezone offset to preserve exact time
      const now = new Date();
      const timezoneOffset = -now.getTimezoneOffset();
      const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
      const offsetMinutes = Math.abs(timezoneOffset) % 60;
      const offsetSign = timezoneOffset >= 0 ? '+' : '-';
      const timezoneString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
      
      // Send time with timezone to preserve exact time
      const scheduledTimeWithTimezone = formData.scheduledTime.includes('+') || formData.scheduledTime.includes('-')
        ? formData.scheduledTime // Already has timezone
        : `${formData.scheduledTime}:00${timezoneString}`;
      
      console.log("📅 Updating trip:");
      console.log("   Date:", formData.tripDate);
      console.log("   Time (with timezone):", scheduledTimeWithTimezone);
      
      const response = await api.put(`/admin/trips/${tripId}`, {
        name: formData.name,
        tripDate: formData.tripDate,
        scheduledTime: scheduledTimeWithTimezone,
        assignedCaptainId: formData.assignedCaptainId,
        points: checkpoints,
      });

      if (response.data.success) {
        router.push(`/dashboard/trips/${tripId}`);
      }
    } catch (error: any) {
      console.error("Error updating trip:", error);
      alert(error.response?.data?.message || "Failed to update trip");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading trip...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Trip not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Edit Scheduled Trip</h1>
        <button
          onClick={() => router.push(`/dashboard/trips/${tripId}`)}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-8 space-y-6">
        {/* Basic Trip Information */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Trip Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trip Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
              placeholder="e.g., Morning Route - Downtown"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trip Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="tripDate"
                value={formData.tripDate}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                name="scheduledTime"
                value={formData.scheduledTime}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign Captain <span className="text-red-500">*</span>
            </label>
            <select
              name="assignedCaptainId"
              value={formData.assignedCaptainId}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
            >
              <option value="">Select a captain</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} ({driver.phone_number})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Checkpoints */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Checkpoints</h2>
            <button
              type="button"
              onClick={addCheckpoint}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Add Checkpoint
            </button>
          </div>

          {checkpoints.map((checkpoint, index) => (
            <div key={checkpoint.id || index} className="border border-gray-200/60 rounded-xl p-5 space-y-4 bg-gray-50/30">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Checkpoint {index + 1}</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => moveCheckpoint(index, "up")}
                    disabled={index === 0}
                    className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCheckpoint(index, "down")}
                    disabled={index === checkpoints.length - 1}
                    className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCheckpoint(index)}
                    disabled={checkpoints.length === 1}
                    className="px-2 py-1 text-sm bg-red-600 text-white rounded disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Checkpoint Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={checkpoint.name}
                  onChange={(e) => handleCheckpointChange(index, "name", e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  placeholder="e.g., Downtown Station"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={checkpoint.latitude || ""}
                    onChange={(e) =>
                      handleCheckpointChange(index, "latitude", parseFloat(e.target.value) || 0)
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                    placeholder="e.g., 23.8103"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={checkpoint.longitude || ""}
                    onChange={(e) =>
                      handleCheckpointChange(index, "longitude", parseFloat(e.target.value) || 0)
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                    placeholder="e.g., 90.4125"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={`final-${index}`}
                  checked={checkpoint.isFinalPoint}
                  onChange={(e) =>
                    handleCheckpointChange(index, "isFinalPoint", e.target.checked)
                  }
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor={`final-${index}`} className="ml-2 text-sm text-gray-700">
                  Mark as final point
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/trips/${tripId}`)}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

