"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import FormField from "@/components/common/FormField";
import LocationPicker from "@/components/trips/LocationPicker";
import CaptainSelector from "@/components/trips/CaptainSelector";
import { TripTemplate, LocationData } from "@/types/trip";
import {
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MapPinIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface CheckpointOverride {
  name?: string;
  latitude?: number;
  longitude?: number;
  expectedTime?: string;
  employees?: Array<{ name?: string; employeeId?: string }>;
  removed?: boolean;
}

interface TripData {
  name: string;
  tripDate: string;
  scheduledTime: string;
  assignedCaptainId?: string;
  price?: number;
  pointOverrides?: CheckpointOverride[];
}

export default function CreateTripsFromTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [template, setTemplate] = useState<TripTemplate | null>(null);
  const [expandedTrips, setExpandedTrips] = useState<Set<number>>(new Set());
  const [checkpointLocations, setCheckpointLocations] = useState<
    Map<string, LocationData | null>
  >(new Map());

  const form = useForm<{ trips: TripData[] }>({
    defaultValues: {
      trips: [
        {
          name: "",
          tripDate: "",
          scheduledTime: "",
          assignedCaptainId: "",
          price: undefined,
          pointOverrides: [],
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "trips",
  });

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/trip-templates/${templateId}`);
        const fetchedTemplate = response.data.template;
        setTemplate(fetchedTemplate);

        // Set default name based on template
        const defaultName = fetchedTemplate.name;
        form.setValue("trips.0.name", defaultName);

        // Initialize checkpoint locations for first trip
        if (fetchedTemplate.points) {
          fetchedTemplate.points.forEach((point: any, index: number) => {
            const key = `0-${index}`;
            setCheckpointLocations((prev) => {
              const newMap = new Map(prev);
              newMap.set(key, {
                latitude: point.latitude,
                longitude: point.longitude,
              });
              return newMap;
            });
          });
        }
      } catch (error) {
        console.error("Error fetching template:", error);
        toast.error("Failed to load template");
        router.push("/dashboard/trips/templates");
      } finally {
        setLoading(false);
      }
    };

    if (templateId) {
      fetchTemplate();
    }
  }, [templateId, router, form]);

  const addTrip = () => {
    const tripIndex = fields.length;
    append({
      name: template?.name || "",
      tripDate: "",
      scheduledTime: "",
      assignedCaptainId: "",
      price: undefined,
      pointOverrides: [],
    });

    // Initialize checkpoint locations for new trip
    if (template?.points) {
      template.points.forEach((point: any, index: number) => {
        const key = `${tripIndex}-${index}`;
        setCheckpointLocations((prev) => {
          const newMap = new Map(prev);
          newMap.set(key, {
            latitude: point.latitude,
            longitude: point.longitude,
          });
          return newMap;
        });
      });
    }
  };

  const toggleTripExpanded = (tripIndex: number) => {
    setExpandedTrips((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tripIndex)) {
        newSet.delete(tripIndex);
      } else {
        newSet.add(tripIndex);
      }
      return newSet;
    });
  };

  const getCheckpointValue = (
    tripIndex: number,
    checkpointIndex: number,
    field: keyof CheckpointOverride
  ) => {
    const override = form.watch(`trips.${tripIndex}.pointOverrides`)?.[
      checkpointIndex
    ];
    if (override && override[field] !== undefined) {
      return override[field];
    }
    const templatePoint = template?.points[checkpointIndex];
    if (!templatePoint) return undefined;

    switch (field) {
      case "name":
        return templatePoint.name;
      case "latitude":
        return templatePoint.latitude;
      case "longitude":
        return templatePoint.longitude;
      case "expectedTime":
        return templatePoint.expectedTime || undefined;
      case "employees":
        return templatePoint.employees || [];
      default:
        return undefined;
    }
  };

  const isCheckpointModified = (tripIndex: number, checkpointIndex: number) => {
    const override = form.watch(`trips.${tripIndex}.pointOverrides`)?.[
      checkpointIndex
    ];
    return override && Object.keys(override).length > 0 && !override.removed;
  };

  const isCheckpointRemoved = (tripIndex: number, checkpointIndex: number) => {
    const override = form.watch(`trips.${tripIndex}.pointOverrides`)?.[
      checkpointIndex
    ];
    return override?.removed === true;
  };

  const updateCheckpointOverride = (
    tripIndex: number,
    checkpointIndex: number,
    updates: Partial<CheckpointOverride>
  ) => {
    const currentOverrides =
      form.getValues(`trips.${tripIndex}.pointOverrides`) || [];
    const newOverrides = [...currentOverrides];

    // Ensure array is long enough
    while (newOverrides.length <= checkpointIndex) {
      newOverrides.push(undefined as any);
    }

    // Merge updates with existing override
    const existingOverride = newOverrides[checkpointIndex] || {};
    newOverrides[checkpointIndex] = {
      ...existingOverride,
      ...updates,
    };

    form.setValue(`trips.${tripIndex}.pointOverrides`, newOverrides);
  };

  const resetCheckpointToTemplate = (
    tripIndex: number,
    checkpointIndex: number
  ) => {
    const currentOverrides =
      form.getValues(`trips.${tripIndex}.pointOverrides`) || [];
    const newOverrides = [...currentOverrides];

    // Remove the override at this index to use template defaults
    // Keep array aligned with template points by index
    if (newOverrides[checkpointIndex]) {
      delete newOverrides[checkpointIndex];
    }

    // Clean up trailing undefined entries but keep array aligned
    while (newOverrides.length > 0 && !newOverrides[newOverrides.length - 1]) {
      newOverrides.pop();
    }

    form.setValue(
      `trips.${tripIndex}.pointOverrides`,
      newOverrides.length > 0 ? newOverrides : []
    );

    // Reset location
    if (template?.points[checkpointIndex]) {
      const point = template.points[checkpointIndex];
      const key = `${tripIndex}-${checkpointIndex}`;
      setCheckpointLocations((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, {
          latitude: point.latitude,
          longitude: point.longitude,
        });
        return newMap;
      });
    }
  };

  const handleLocationChange = (
    tripIndex: number,
    checkpointIndex: number,
    location: LocationData | null
  ) => {
    if (location) {
      updateCheckpointOverride(tripIndex, checkpointIndex, {
        latitude: location.latitude,
        longitude: location.longitude,
      });
      const key = `${tripIndex}-${checkpointIndex}`;
      setCheckpointLocations((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, location);
        return newMap;
      });
    }
  };

  const onSubmit = async (data: { trips: TripData[] }) => {
    try {
      setSubmitting(true);

      // Validate all trips have required fields
      const invalidTrips = data.trips.filter(
        (trip) => !trip.name || !trip.tripDate || !trip.scheduledTime
      );

      if (invalidTrips.length > 0) {
        toast.error("Please fill in all required fields for each trip");
        return;
      }

      const response = await api.post(
        `/admin/trip-templates/${templateId}/create-trips`,
        {
          trips: data.trips.map((trip) => {
            // Filter out undefined entries from pointOverrides but keep array aligned
            const cleanedOverrides = (trip.pointOverrides || []).map(
              (override, index) => {
                if (!override || Object.keys(override).length === 0) {
                  return undefined;
                }
                return override;
              }
            );

            return {
              name: trip.name,
              tripDate: trip.tripDate,
              scheduledTime: trip.scheduledTime,
              assignedCaptainId: trip.assignedCaptainId || undefined,
              price: trip.price || undefined,
              pointOverrides:
                cleanedOverrides.length > 0 ? cleanedOverrides : [],
            };
          }),
        }
      );

      if (response.data.success) {
        const created = response.data.created || 0;
        const errors = response.data.errors || [];

        if (errors.length > 0) {
          toast.error(
            `Created ${created} trips, but ${errors.length} failed. Check console for details.`
          );
          console.error("Errors:", errors);
        } else {
          toast.success(`Successfully created ${created} trips!`);
        }

        router.push("/dashboard/trips");
      }
    } catch (error: any) {
      console.error("Error creating trips:", error);
      toast.error(error.response?.data?.message || "Failed to create trips");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Loading template..." />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Create Trips from Template
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create multiple trips using "{template.name}" template
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Trip Details
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Fill in the details for each trip you want to create
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={PlusIcon}
                onClick={addTrip}
              >
                Add Trip
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50/30"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-gray-900">
                      Trip {index + 1}
                    </h3>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        icon={TrashIcon}
                        onClick={() => remove(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      label="Trip Name"
                      required
                      error={form.formState.errors.trips?.[index]?.name}
                    >
                      <input
                        type="text"
                        {...form.register(`trips.${index}.name`, {
                          required: "Trip name is required",
                        })}
                        placeholder="e.g., Morning Route - Monday"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </FormField>

                    <FormField
                      label="Trip Date"
                      required
                      error={form.formState.errors.trips?.[index]?.tripDate}
                    >
                      <input
                        type="date"
                        {...form.register(`trips.${index}.tripDate`, {
                          required: "Trip date is required",
                        })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </FormField>

                    <FormField
                      label="Scheduled Time"
                      required
                      error={
                        form.formState.errors.trips?.[index]?.scheduledTime
                      }
                    >
                      <input
                        type="time"
                        {...form.register(`trips.${index}.scheduledTime`, {
                          required: "Scheduled time is required",
                        })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </FormField>

                    <FormField
                      label="Price (Optional)"
                      error={form.formState.errors.trips?.[index]?.price}
                      hint="Leave empty to use template default"
                    >
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...form.register(`trips.${index}.price`, {
                          valueAsNumber: true,
                        })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </FormField>
                  </div>

                  <div className="mt-4">
                    <FormField
                      label="Assign Captain"
                      hint="Optional - can be assigned later. Search by phone number, name, or email."
                      error={
                        form.formState.errors.trips?.[index]?.assignedCaptainId
                      }
                    >
                      <Controller
                        control={form.control}
                        name={`trips.${index}.assignedCaptainId`}
                        render={({ field, fieldState }) => (
                          <CaptainSelector
                            value={field.value}
                            onChange={(captainId) => {
                              field.onChange(captainId || "");
                            }}
                            error={fieldState.error}
                            disabled={submitting}
                          />
                        )}
                      />
                    </FormField>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <p>
                        <strong>Template:</strong> {template.name} (
                        {template.tripType})
                      </p>
                      {template.company && (
                        <p>
                          <strong>Company:</strong> {template.company.name}
                        </p>
                      )}
                      <p>
                        <strong>Checkpoints:</strong> {template.points.length}
                        {(() => {
                          const modifiedCount = template.points.filter(
                            (_, cpIndex) => isCheckpointModified(index, cpIndex)
                          ).length;
                          const removedCount = template.points.filter(
                            (_, cpIndex) => isCheckpointRemoved(index, cpIndex)
                          ).length;
                          if (modifiedCount > 0 || removedCount > 0) {
                            return (
                              <span className="ml-2 text-indigo-600">
                                ({modifiedCount} modified, {removedCount}{" "}
                                removed)
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={
                        expandedTrips.has(index)
                          ? ChevronUpIcon
                          : ChevronDownIcon
                      }
                      onClick={() => toggleTripExpanded(index)}
                    >
                      {expandedTrips.has(index) ? "Hide" : "Edit"} Checkpoints
                    </Button>
                  </div>

                  {expandedTrips.has(index) && template && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Checkpoints
                        </h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Reset all checkpoints to template
                            template.points.forEach((_, cpIndex) => {
                              resetCheckpointToTemplate(index, cpIndex);
                            });
                            toast.success("Checkpoints reset to template");
                          }}
                        >
                          Reset to Template
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {template.points.map((templatePoint, cpIndex) => {
                          const isRemoved = isCheckpointRemoved(index, cpIndex);
                          const isModified = isCheckpointModified(
                            index,
                            cpIndex
                          );
                          const locationKey = `${index}-${cpIndex}`;
                          const location = checkpointLocations.get(locationKey);

                          return (
                            <div
                              key={cpIndex}
                              className={`border rounded-lg p-4 ${
                                isRemoved
                                  ? "bg-red-50 border-red-200 opacity-60"
                                  : isModified
                                  ? "bg-yellow-50 border-yellow-200"
                                  : "bg-white border-gray-200"
                              }`}
                            >
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                  <MapPinIcon className="h-5 w-5 text-indigo-600" />
                                  <h5 className="font-medium text-gray-900">
                                    Checkpoint {cpIndex + 1}
                                  </h5>
                                  {templatePoint.isFinalPoint && (
                                    <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full">
                                      Final Point
                                    </span>
                                  )}
                                  {isModified && !isRemoved && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                                      Modified
                                    </span>
                                  )}
                                  {isRemoved && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                      Removed
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  {!isRemoved && (
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        // Check if this would be the last checkpoint
                                        const remainingCount =
                                          template.points.filter(
                                            (_, idx) =>
                                              idx === cpIndex ||
                                              !isCheckpointRemoved(index, idx)
                                          ).length;

                                        if (remainingCount <= 1) {
                                          toast.error(
                                            "Cannot remove the last checkpoint. At least one checkpoint is required."
                                          );
                                          return;
                                        }

                                        updateCheckpointOverride(
                                          index,
                                          cpIndex,
                                          {
                                            removed: true,
                                          }
                                        );
                                      }}
                                    >
                                      Remove
                                    </Button>
                                  )}
                                  {isRemoved && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        updateCheckpointOverride(
                                          index,
                                          cpIndex,
                                          {
                                            removed: false,
                                          }
                                        );
                                      }}
                                    >
                                      Restore
                                    </Button>
                                  )}
                                  {isModified && !isRemoved && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        resetCheckpointToTemplate(
                                          index,
                                          cpIndex
                                        );
                                      }}
                                    >
                                      Reset
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {!isRemoved && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="Checkpoint Name">
                                      <input
                                        type="text"
                                        value={
                                          (getCheckpointValue(
                                            index,
                                            cpIndex,
                                            "name"
                                          ) as string) || ""
                                        }
                                        onChange={(e) => {
                                          const templateName =
                                            templatePoint.name;
                                          if (e.target.value !== templateName) {
                                            updateCheckpointOverride(
                                              index,
                                              cpIndex,
                                              { name: e.target.value }
                                            );
                                          } else {
                                            const overrides =
                                              form.getValues(
                                                `trips.${index}.pointOverrides`
                                              ) || [];
                                            const newOverrides = [...overrides];
                                            if (newOverrides[cpIndex]) {
                                              const { name, ...rest } =
                                                newOverrides[cpIndex];
                                              newOverrides[cpIndex] = rest;
                                            }
                                            form.setValue(
                                              `trips.${index}.pointOverrides`,
                                              newOverrides
                                            );
                                          }
                                        }}
                                        placeholder={templatePoint.name}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                      />
                                    </FormField>

                                    {template.tripType === "ARRIVAL" && (
                                      <FormField label="Expected Time" required>
                                        <input
                                          type="time"
                                          value={
                                            (getCheckpointValue(
                                              index,
                                              cpIndex,
                                              "expectedTime"
                                            ) as string) || ""
                                          }
                                          onChange={(e) => {
                                            const templateTime =
                                              templatePoint.expectedTime || "";
                                            if (
                                              e.target.value !== templateTime
                                            ) {
                                              updateCheckpointOverride(
                                                index,
                                                cpIndex,
                                                { expectedTime: e.target.value }
                                              );
                                            } else {
                                              const overrides =
                                                form.getValues(
                                                  `trips.${index}.pointOverrides`
                                                ) || [];
                                              const newOverrides = [
                                                ...overrides,
                                              ];
                                              if (newOverrides[cpIndex]) {
                                                const {
                                                  expectedTime,
                                                  ...rest
                                                } = newOverrides[cpIndex];
                                                newOverrides[cpIndex] = rest;
                                              }
                                              form.setValue(
                                                `trips.${index}.pointOverrides`,
                                                newOverrides
                                              );
                                            }
                                          }}
                                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                        />
                                      </FormField>
                                    )}

                                    {template.tripType === "DEPARTURE" && (
                                      <FormField label="Expected Time (Optional)">
                                        <input
                                          type="time"
                                          value={
                                            (getCheckpointValue(
                                              index,
                                              cpIndex,
                                              "expectedTime"
                                            ) as string) || ""
                                          }
                                          onChange={(e) => {
                                            const templateTime =
                                              templatePoint.expectedTime || "";
                                            if (
                                              e.target.value !== templateTime
                                            ) {
                                              updateCheckpointOverride(
                                                index,
                                                cpIndex,
                                                { expectedTime: e.target.value }
                                              );
                                            } else {
                                              const overrides =
                                                form.getValues(
                                                  `trips.${index}.pointOverrides`
                                                ) || [];
                                              const newOverrides = [
                                                ...overrides,
                                              ];
                                              if (newOverrides[cpIndex]) {
                                                const {
                                                  expectedTime,
                                                  ...rest
                                                } = newOverrides[cpIndex];
                                                newOverrides[cpIndex] = rest;
                                              }
                                              form.setValue(
                                                `trips.${index}.pointOverrides`,
                                                newOverrides
                                              );
                                            }
                                          }}
                                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                        />
                                      </FormField>
                                    )}
                                  </div>

                                  <LocationPicker
                                    value={location || undefined}
                                    onChange={(loc) =>
                                      handleLocationChange(index, cpIndex, loc)
                                    }
                                    label="Location"
                                    placeholder="Search for a location or pick on map..."
                                    mapCenter={
                                      location
                                        ? {
                                            lat: location.latitude,
                                            lng: location.longitude,
                                          }
                                        : {
                                            lat: templatePoint.latitude,
                                            lng: templatePoint.longitude,
                                          }
                                    }
                                  />

                                  {/* Employees Section */}
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <UserIcon className="h-5 w-5 text-indigo-600" />
                                        <h6 className="text-sm font-semibold text-gray-900">
                                          Employees at this checkpoint
                                        </h6>
                                        {(() => {
                                          const employees =
                                            (getCheckpointValue(
                                              index,
                                              cpIndex,
                                              "employees"
                                            ) as Array<{
                                              name?: string;
                                              employeeId?: string;
                                            }>) || [];
                                          return employees.length > 0 ? (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                              {employees.length}
                                            </span>
                                          ) : null;
                                        })()}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        icon={PlusIcon}
                                        onClick={() => {
                                          const currentEmployees =
                                            (getCheckpointValue(
                                              index,
                                              cpIndex,
                                              "employees"
                                            ) as Array<{
                                              name?: string;
                                              employeeId?: string;
                                            }>) || [];
                                          updateCheckpointOverride(
                                            index,
                                            cpIndex,
                                            {
                                              employees: [
                                                ...currentEmployees,
                                                { name: "", employeeId: "" },
                                              ],
                                            }
                                          );
                                        }}
                                      >
                                        Add Employee
                                      </Button>
                                    </div>

                                    {(() => {
                                      const employees =
                                        (getCheckpointValue(
                                          index,
                                          cpIndex,
                                          "employees"
                                        ) as Array<{
                                          name?: string;
                                          employeeId?: string;
                                        }>) || [];
                                      return employees.length > 0 ? (
                                        <div className="space-y-2">
                                          {employees.map(
                                            (employee, empIndex) => (
                                              <div
                                                key={empIndex}
                                                className="flex gap-2 items-start p-3 bg-white border border-gray-200 rounded-lg"
                                              >
                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                  <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                      Employee Name (Optional)
                                                    </label>
                                                    <input
                                                      type="text"
                                                      value={
                                                        employee.name || ""
                                                      }
                                                      onChange={(e) => {
                                                        const currentEmployees =
                                                          (getCheckpointValue(
                                                            index,
                                                            cpIndex,
                                                            "employees"
                                                          ) as Array<{
                                                            name?: string;
                                                            employeeId?: string;
                                                          }>) || [];
                                                        const newEmployees = [
                                                          ...currentEmployees,
                                                        ];
                                                        newEmployees[empIndex] =
                                                          {
                                                            ...newEmployees[
                                                              empIndex
                                                            ],
                                                            name: e.target
                                                              .value,
                                                          };
                                                        updateCheckpointOverride(
                                                          index,
                                                          cpIndex,
                                                          {
                                                            employees:
                                                              newEmployees,
                                                          }
                                                        );
                                                      }}
                                                      placeholder="e.g., John Doe"
                                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    />
                                                  </div>
                                                  <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                      Employee ID (Optional)
                                                    </label>
                                                    <input
                                                      type="text"
                                                      value={
                                                        employee.employeeId ||
                                                        ""
                                                      }
                                                      onChange={(e) => {
                                                        const currentEmployees =
                                                          (getCheckpointValue(
                                                            index,
                                                            cpIndex,
                                                            "employees"
                                                          ) as Array<{
                                                            name?: string;
                                                            employeeId?: string;
                                                          }>) || [];
                                                        const newEmployees = [
                                                          ...currentEmployees,
                                                        ];
                                                        newEmployees[empIndex] =
                                                          {
                                                            ...newEmployees[
                                                              empIndex
                                                            ],
                                                            employeeId:
                                                              e.target.value,
                                                          };
                                                        updateCheckpointOverride(
                                                          index,
                                                          cpIndex,
                                                          {
                                                            employees:
                                                              newEmployees,
                                                          }
                                                        );
                                                      }}
                                                      placeholder="e.g., EMP001"
                                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    />
                                                  </div>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const currentEmployees =
                                                      (getCheckpointValue(
                                                        index,
                                                        cpIndex,
                                                        "employees"
                                                      ) as Array<{
                                                        name?: string;
                                                        employeeId?: string;
                                                      }>) || [];
                                                    const newEmployees = [
                                                      ...currentEmployees,
                                                    ];
                                                    newEmployees.splice(
                                                      empIndex,
                                                      1
                                                    );
                                                    updateCheckpointOverride(
                                                      index,
                                                      cpIndex,
                                                      {
                                                        employees: newEmployees,
                                                      }
                                                    );
                                                  }}
                                                  className="mt-6 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                                                  title="Remove employee"
                                                >
                                                  <XMarkIcon className="h-5 w-5" />
                                                </button>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-500 italic">
                                          No employees added. Click "Add
                                          Employee" to add employees who should
                                          be picked up at this checkpoint.
                                        </p>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} loading={submitting}>
            {submitting
              ? "Creating..."
              : `Create ${fields.length} Trip${fields.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
