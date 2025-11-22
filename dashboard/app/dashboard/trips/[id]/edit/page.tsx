"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useFieldArray, Controller } from "react-hook-form";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import { useTripForm } from "@/hooks/useTripForm";
import LocationPicker from "@/components/trips/LocationPicker";
import FormField from "@/components/common/FormField";
import Card, { CardBody, CardHeader } from "@/components/common/Card";
import Button from "@/components/common/Button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import {
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { LocationData, ScheduledTrip } from "@/types/trip";

interface Driver {
  id: string;
  name: string;
  phone_number: string;
  email: string;
  status: string;
}

export default function EditTripPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trip, setTrip] = useState<ScheduledTrip | null>(null);
  const [checkpointLocations, setCheckpointLocations] = useState<
    Map<number, LocationData | null>
  >(new Map());

  const { form, handleSubmit, isSubmitting, isDirty } = useTripForm({
    defaultValues: {
      name: "",
      tripDate: "",
      scheduledTime: "",
      assignedCaptainId: "",
      points: [],
    },
    onSubmit: async (data) => {
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
      const scheduledTimeWithTimezone = `${data.scheduledTime}:00${timezoneString}`;

      const response = await api.put(`/admin/trips/${tripId}`, {
        name: data.name,
        tripDate: data.tripDate,
        scheduledTime: scheduledTimeWithTimezone,
        assignedCaptainId: data.assignedCaptainId || undefined,
        points: data.points,
      });

      if (response.data.success) {
        toast.success("Trip updated successfully!");
        router.push(`/dashboard/trips/${tripId}`);
      }
    },
    onError: (errors) => {
      const firstError = Object.values(errors)[0] as any;
      if (firstError?.message) {
        toast.error(firstError.message);
      } else {
        toast.error("Please fix the errors in the form");
      }
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "points",
  });

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
        const timeStr = scheduledDate.toTimeString().slice(0, 5);

        // Pre-populate form
        form.reset({
          name: tripData.name,
          tripDate: dateStr,
          scheduledTime: timeStr,
          assignedCaptainId: tripData.assignedCaptainId || "",
          points: tripData.points.map((point: any) => ({
            id: point.id,
            name: point.name,
            latitude: point.latitude,
            longitude: point.longitude,
            order: point.order,
            isFinalPoint: point.isFinalPoint,
          })),
        });

        // Pre-populate location pickers
        const locations = new Map<number, LocationData | null>();
        tripData.points.forEach((point: any, index: number) => {
          locations.set(index, {
            latitude: point.latitude,
            longitude: point.longitude,
            address: point.name,
          });
        });
        setCheckpointLocations(locations);
      }
    } catch (error: any) {
      console.error("Error fetching trip:", error);
      toast.error(error.response?.data?.message || "Failed to load trip");
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
      toast.error("Failed to load drivers");
    }
  };

  const addCheckpoint = () => {
    append({
      name: "",
      latitude: 0,
      longitude: 0,
      order: fields.length,
      isFinalPoint: false,
    });
  };

  const removeCheckpoint = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      const newMap = new Map(checkpointLocations);
      newMap.delete(index);
      const reindexed = new Map<number, LocationData | null>();
      newMap.forEach((value, key) => {
        if (key > index) {
          reindexed.set(key - 1, value);
        } else if (key < index) {
          reindexed.set(key, value);
        }
      });
      setCheckpointLocations(reindexed);
    } else {
      toast.error("At least one checkpoint is required");
    }
  };

  const moveCheckpoint = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === fields.length - 1)
    ) {
      return;
    }

    const newIndex = direction === "up" ? index - 1 : index + 1;
    move(index, newIndex);

    const newMap = new Map(checkpointLocations);
    const location1 = newMap.get(index);
    const location2 = newMap.get(newIndex);
    if (location1 !== undefined) newMap.set(newIndex, location1);
    if (location2 !== undefined) newMap.set(index, location2);
    setCheckpointLocations(newMap);
  };

  const handleLocationChange = (
    index: number,
    location: LocationData | null
  ) => {
    if (location) {
      form.setValue(`points.${index}.latitude`, location.latitude);
      form.setValue(`points.${index}.longitude`, location.longitude);
      const newMap = new Map(checkpointLocations);
      newMap.set(index, location);
      setCheckpointLocations(newMap);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" text="Loading trip..." />
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Scheduled Trip</h1>
          {isDirty && (
            <p className="text-sm text-gray-500 mt-1">You have unsaved changes</p>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={() => router.push(`/dashboard/trips/${tripId}`)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>

      <form onSubmit={(e) => {
        handleSubmit(e);
      }}>
        <div className="space-y-6">
          {/* Section 1: Basic Information */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                Basic Information
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter the trip name, date, and scheduled time
              </p>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <FormField
                  label="Trip Name"
                  required
                  error={form.formState.errors.name}
                >
                  <input
                    type="text"
                    {...form.register("name")}
                    placeholder="e.g., Morning Route - Downtown"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  />
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Trip Date"
                    required
                    error={form.formState.errors.tripDate}
                  >
                    <input
                      type="date"
                      {...form.register("tripDate")}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                    />
                  </FormField>

                  <FormField
                    label="Scheduled Time"
                    required
                    error={form.formState.errors.scheduledTime}
                  >
                    <input
                      type="time"
                      {...form.register("scheduledTime")}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                    />
                  </FormField>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Section 2: Assignment */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                Assignment
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Assign a captain to this trip
              </p>
            </CardHeader>
            <CardBody>
              <FormField
                label="Assign Captain"
                required
                error={form.formState.errors.assignedCaptainId}
              >
                <select
                  {...form.register("assignedCaptainId")}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                >
                  <option value="">Select a captain</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} ({driver.phone_number})
                    </option>
                  ))}
                </select>
              </FormField>
            </CardBody>
          </Card>

          {/* Section 3: Route Planning */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Route Planning
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Add checkpoints for the trip route
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={addCheckpoint}
                  icon={PlusIcon}
                  size="sm"
                >
                  Add Checkpoint
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {form.formState.errors.points && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">
                    {form.formState.errors.points.message ||
                      "Please fix checkpoint errors"}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {fields.map((field, index) => {
                  const location = checkpointLocations.get(index);
                  const pointError = form.formState.errors.points?.[index];

                  return (
                    <div
                      key={field.id}
                      className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50/30"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="h-5 w-5 text-indigo-600" />
                          <h3 className="font-medium text-gray-900">
                            Checkpoint {index + 1}
                          </h3>
                          {form.watch(`points.${index}.isFinalPoint`) && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full">
                              Final Point
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={ChevronUpIcon}
                            onClick={() => moveCheckpoint(index, "up")}
                            disabled={index === 0}
                          >
                            Up
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={ChevronDownIcon}
                            onClick={() => moveCheckpoint(index, "down")}
                            disabled={index === fields.length - 1}
                          >
                            Down
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            icon={TrashIcon}
                            onClick={() => removeCheckpoint(index)}
                            disabled={fields.length === 1}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <FormField
                            label="Checkpoint Name"
                            required
                            error={pointError?.name}
                          >
                            <input
                              type="text"
                              {...form.register(`points.${index}.name`)}
                              placeholder="e.g., Downtown Station"
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                            />
                          </FormField>
                        </div>

                        <div>
                          <Controller
                            control={form.control}
                            name={`points.${index}.isFinalPoint`}
                            render={({ field: checkboxField }) => (
                              <div className="flex items-center h-full pt-8">
                                <input
                                  type="checkbox"
                                  id={`final-${index}`}
                                  {...checkboxField}
                                  checked={checkboxField.value}
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <label
                                  htmlFor={`final-${index}`}
                                  className="ml-2 text-sm font-medium text-gray-700"
                                >
                                  Mark as final point
                                </label>
                              </div>
                            )}
                          />
                        </div>
                      </div>

                      <LocationPicker
                        value={location || undefined}
                        onChange={(loc) => handleLocationChange(index, loc)}
                        label="Location"
                        placeholder="Search for a location or pick on map..."
                        required
                        error={
                          pointError?.latitude || pointError?.longitude
                            ? {
                                type: "manual",
                                message:
                                  pointError.latitude?.message ||
                                  pointError.longitude?.message ||
                                  "Location is required",
                              }
                            : undefined
                        }
                        mapCenter={
                          location
                            ? {
                                lat: location.latitude,
                                lng: location.longitude,
                              }
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Section 4: Actions */}
          <Card>
            <CardBody>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push(`/dashboard/trips/${tripId}`)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </form>
    </div>
  );
}
