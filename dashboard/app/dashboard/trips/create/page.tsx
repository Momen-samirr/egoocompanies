"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface Driver {
  id: string;
  name: string;
  phone_number: string;
  email: string;
  status: string;
}

interface Checkpoint {
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  isFinalPoint: boolean;
}

export default function CreateTripPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    tripDate: "",
    scheduledTime: "",
    assignedCaptainId: "",
  });
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([
    { name: "", latitude: 0, longitude: 0, order: 0, isFinalPoint: false },
  ]);

  useEffect(() => {
    fetchDrivers();
  }, []);

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

    // Validation (captain is optional)
    if (!formData.name || !formData.tripDate || !formData.scheduledTime) {
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
      setLoading(true);
      const response = await api.post("/admin/trips", {
        ...formData,
        points: checkpoints,
      });

      if (response.data.success) {
        router.push("/dashboard/trips");
      }
    } catch (error: any) {
      console.error("Error creating trip:", error);
      alert(error.response?.data?.message || "Failed to create trip");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Create Scheduled Trip</h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign Captain <span className="text-gray-500 text-xs">(Optional - can be assigned later)</span>
            </label>
            <select
              name="assignedCaptainId"
              value={formData.assignedCaptainId}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No captain assigned yet</option>
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
            <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Trip"}
          </button>
        </div>
      </form>
    </div>
  );
}

