"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useFieldArray, Controller, FieldErrors } from "react-hook-form";
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
import { LocationData, ScheduledTrip, TripFormData } from "@/types/trip";
import { Company } from "@/types";

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
  const [companies, setCompanies] = useState<Company[]>([]);
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
      companyId: "",
      price: 0,
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
        tripType: data.tripType,
        assignedCaptainId: data.assignedCaptainId || undefined,
        companyId: data.companyId,
        price: data.price,
        points: data.points,
      });

      if (response.data.success) {
        toast.success("Trip updated successfully!");
        router.push(`/dashboard/trips/${tripId}`);
      }
    },
    onError: (errors: FieldErrors<TripFormData>) => {
      const firstError = Object.values(errors)[0];
      const firstMessage =
        typeof firstError === "object" && firstError && "message" in firstError
          ? (firstError as { message?: string }).message
          : undefined;

      if (firstMessage) {
        toast.error(firstMessage);
      } else {
        toast.error("Please fix the errors in the form");
      }
    },
  });

  const companyIdRegister = form.register("companyId");

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
        "string"
    ) {
      return (
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        fallback
      );
    }
    return fallback;
  };

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "points",
  });

  const fetchTrip = useCallback(async () => {
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

        // Format expectedTime for points if available
        const formatExpectedTime = (expectedTime: string | null | undefined) => {
          if (!expectedTime) return undefined;
          const time = new Date(expectedTime);
          // Use UTC methods since we store it as UTC to preserve the exact time entered
          const hours = time.getUTCHours().toString().padStart(2, '0');
          const minutes = time.getUTCMinutes().toString().padStart(2, '0');
          return `${hours}:${minutes}`; // HH:MM format
        };

        // Pre-populate form
        form.reset({
          name: tripData.name,
          tripDate: dateStr,
          scheduledTime: timeStr,
          tripType: tripData.tripType || ("DEPARTURE" as any),
          assignedCaptainId: tripData.assignedCaptainId || "",
          companyId: tripData.companyId,
          price: tripData.price,
          points: tripData.points.map((point: ScheduledTrip["points"][number]) => ({
            id: point.id,
            name: point.name,
            latitude: point.latitude,
            longitude: point.longitude,
            order: point.order,
            isFinalPoint: point.isFinalPoint,
            expectedTime: formatExpectedTime(point.expectedTime),
          })),
        });

        // Pre-populate location pickers
        const locations = new Map<number, LocationData | null>();
        tripData.points.forEach((point: ScheduledTrip["points"][number], index: number) => {
          locations.set(index, {
            latitude: point.latitude,
            longitude: point.longitude,
            address: point.name,
          });
        });
        setCheckpointLocations(locations);
      }
    } catch (error) {
      console.error("Error fetching trip:", error);
      toast.error(getErrorMessage(error, "Failed to load trip"));
      router.push("/dashboard/trips");
    } finally {
      setLoading(false);
    }
  }, [form, router, tripId]);

  const fetchDrivers = useCallback(async () => {
    try {
      const response = await api.get("/admin/drivers?limit=100&status=active");
      setDrivers(response.data.drivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      toast.error("Failed to load drivers");
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await api.get("/admin/companies");
      setCompanies(response.data.companies || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to load companies");
    }
  }, []);

  useEffect(() => {
    fetchTrip();
    fetchDrivers();
    fetchCompanies();
  }, [fetchTrip, fetchDrivers, fetchCompanies]);

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

  const handleCompanyChange = (companyId: string) => {
    const selectedCompany = companies.find((company) => company.id === companyId);
    if (selectedCompany) {
      form.setValue("price", selectedCompany.defaultScheduledTripPrice, {
        shouldDirty: true,
        shouldValidate: true,
      });
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
          {trip.status === "ACTIVE" && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> This trip is currently active. You can modify points, but changes may affect the trip in progress.
              </p>
            </div>
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

                <FormField
                  label="Trip Type"
                  required
                  error={form.formState.errors.tripType}
                  hint="Arrival trips require expected times for all checkpoints. Departure trips have optional checkpoint times."
                >
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="ARRIVAL"
                        {...form.register("tripType")}
                        className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Arrival (Hodoor)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="DEPARTURE"
                        {...form.register("tripType")}
                        className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Departure (Ensraf)
                      </span>
                    </label>
                  </div>
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Company"
                    required
                    error={form.formState.errors.companyId}
                  >
                    <select
                      {...companyIdRegister}
                      onChange={(event) => {
                        companyIdRegister.onChange(event);
                        handleCompanyChange(event.target.value);
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                      disabled={companies.length === 0}
                    >
                      <option value="">
                        {companies.length === 0
                          ? "No companies available"
                          : "Select a company"}
                      </option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    {companies.length === 0 && (
                      <p className="text-sm text-amber-600 mt-2">
                        Please add a company before editing trips.
                      </p>
                    )}
                  </FormField>

                  <FormField
                    label="Trip Price"
                    required
                    error={form.formState.errors.price}
                  >
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...form.register("price", { valueAsNumber: true })}
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
                            render={({ field: { value, onChange, onBlur, name, ref } }) => (
                              <div className="flex items-center h-full pt-8">
                                <input
                                  type="checkbox"
                                  id={`final-${index}`}
                                  name={name}
                                  ref={ref}
                                  checked={value}
                                  onChange={onChange}
                                  onBlur={onBlur}
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

                      {form.watch("tripType") === "ARRIVAL" && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <FormField
                            label="Expected Time"
                            required
                            error={pointError?.expectedTime}
                            hint="The time the captain should reach this checkpoint"
                          >
                            <input
                              type="time"
                              {...form.register(`points.${index}.expectedTime`)}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                            />
                          </FormField>
                        </div>
                      )}

                      {form.watch("tripType") === "DEPARTURE" && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <FormField
                            label="Expected Time (Optional)"
                            error={pointError?.expectedTime}
                            hint="Optional: The expected time for this checkpoint"
                          >
                            <input
                              type="time"
                              {...form.register(`points.${index}.expectedTime`)}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                            />
                          </FormField>
                        </div>
                      )}

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
