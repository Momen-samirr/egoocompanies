"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, Controller, FieldErrors } from "react-hook-form";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import { useTripForm } from "@/hooks/useTripForm";
import LocationPicker from "@/components/trips/LocationPicker";
import CaptainSelector from "@/components/trips/CaptainSelector";
import FormField from "@/components/common/FormField";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MapPinIcon,
  UserIcon,
  XMarkIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";
import { LocationData, TripFormData } from "@/types/trip";

interface School {
  id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

interface Route {
  id: string;
  name: string;
  description?: string;
  schoolId: string;
  school: {
    id: string;
    name: string;
  };
  _count?: {
    stops: number;
    trips: number;
  };
}

export default function CreateSchoolTripPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [routeStops, setRouteStops] = useState<any[]>([]);
  const [checkpointLocations, setCheckpointLocations] = useState<
    Map<number, LocationData | null>
  >(new Map());

  // Filter routes by selected school
  const filteredRoutes = useMemo(() => {
    if (!selectedSchoolId) return [];
    return routes.filter((route) => route.schoolId === selectedSchoolId);
  }, [routes, selectedSchoolId]);

  // Get selected school and route for name generation
  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);
  const selectedRoute = filteredRoutes.find((r) => r.id === selectedRouteId);

  // Auto-generate trip name
  const generateTripName = () => {
    if (!selectedSchool || !selectedRoute) return "";

    const tripDate = form.getValues("tripDate");
    const scheduledTime = form.getValues("scheduledTime");

    if (!tripDate || !scheduledTime) return "";

    // Format date as YYYY-MM-DD
    const formattedDate = tripDate;
    // Format time as HH:MM
    const formattedTime = scheduledTime;

    return `${selectedSchool.name} - ${selectedRoute.name} - ${formattedDate} ${formattedTime}`;
  };

  const { form, handleSubmit, handleDraftSave, isSubmitting, isDirty } =
    useTripForm({
      onSubmit: async (data) => {
        if (!selectedRouteId) {
          toast.error("Please select a route for school trips");
          return;
        }
        if (!selectedSchoolId) {
          toast.error("Please select a school");
          return;
        }

        // Auto-generate trip name if not set or update it
        const tripName = generateTripName() || data.name;

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

        const response = await api.post("/admin/trips", {
          name: tripName,
          tripDate: data.tripDate,
          scheduledTime: scheduledTimeWithTimezone,
          tripType: data.tripType,
          assignedCaptainId: data.assignedCaptainId || undefined,
          routeId: selectedRouteId,
          points: data.points.map((point: any, index: number) => ({
            ...point,
            stopId: (point as any).stopId || undefined,
          })),
        });

        if (response.data.success) {
          toast.success("School trip created successfully!");
          router.push("/dashboard/trips");
        }
      },
      onDraftSave: () => {
        toast.success("Draft saved", { duration: 2000 });
      },
      onError: (errors: FieldErrors<TripFormData>) => {
        const firstError = Object.values(errors)[0];
        const firstMessage =
          typeof firstError === "object" &&
          firstError &&
          "message" in firstError
            ? (firstError as { message?: string }).message
            : undefined;

        if (firstMessage) {
          toast.error(firstMessage);
        } else {
          toast.error("Please fix the errors in the form");
        }
      },
    });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "points",
  });

  // Fetch schools
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const response = await api.get("/admin/schools");
        setSchools(response.data.schools || []);
      } catch (error) {
        console.error("Error fetching schools:", error);
        toast.error("Failed to load schools");
      }
    };
    fetchSchools();
  }, []);

  // Fetch all routes
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await api.get("/admin/routes");
        setRoutes(response.data.routes || []);
      } catch (error) {
        console.error("Error fetching routes:", error);
        toast.error("Failed to load routes");
      }
    };
    fetchRoutes();
  }, []);

  // Fetch stops when route is selected
  useEffect(() => {
    const fetchStops = async () => {
      if (!selectedRouteId) {
        setRouteStops([]);
        return;
      }
      try {
        const response = await api.get("/admin/stops", {
          params: { routeId: selectedRouteId },
        });
        setRouteStops(response.data.stops || []);
      } catch (error) {
        console.error("Error fetching stops:", error);
        setRouteStops([]);
      }
    };
    fetchStops();
  }, [selectedRouteId]);

  // Auto-load stops as checkpoints when route is selected
  useEffect(() => {
    if (selectedRouteId && routeStops.length > 0) {
      // Check if there are existing checkpoints
      const currentCheckpoints = form.getValues("points") || [];

      // Only auto-load if there are no checkpoints
      if (currentCheckpoints.length === 0) {
        // Create checkpoints from stops
        const newCheckpoints = routeStops.map((stop, index) => ({
          name: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
          order: stop.order,
          isFinalPoint: stop.stopType === "FINAL_STOP" || index === routeStops.length - 1, // Mark FINAL_STOP or last stop as final point
          employees: [],
          stopId: stop.id,
        }));

        // Clear existing fields and set new checkpoints
        setTimeout(() => {
          newCheckpoints.forEach((checkpoint) => {
            append(checkpoint);
          });

          // Update checkpoint locations map
          const newLocations = new Map<number, LocationData | null>();
          routeStops.forEach((stop, index) => {
            newLocations.set(index, {
              latitude: stop.latitude,
              longitude: stop.longitude,
            });
          });
          setCheckpointLocations(newLocations);
        }, 0);

        toast.success(
          `Loaded ${routeStops.length} stop${
            routeStops.length !== 1 ? "s" : ""
          } as checkpoints`
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRouteId, routeStops.length]);

  // Auto-update trip name when relevant fields change
  useEffect(() => {
    const generatedName = generateTripName();
    if (generatedName) {
      form.setValue("name", generatedName, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolId, selectedRouteId, form.watch("tripDate"), form.watch("scheduledTime")]);

  // Clear route selection when school changes
  useEffect(() => {
    if (selectedSchoolId) {
      // Check if current route belongs to new school
      if (selectedRouteId) {
        const routeStillValid = filteredRoutes.some(
          (r) => r.id === selectedRouteId
        );
        if (!routeStillValid) {
          setSelectedRouteId("");
          // Clear checkpoints
          fields.forEach((_, index) => remove(index));
          setCheckpointLocations(new Map());
        }
      }
    } else {
      // Clear route if no school selected
      setSelectedRouteId("");
      fields.forEach((_, index) => remove(index));
      setCheckpointLocations(new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolId]);

  const addCheckpoint = () => {
    append({
      name: "",
      latitude: 0,
      longitude: 0,
      order: fields.length,
      isFinalPoint: false,
      employees: [],
    });
  };

  const removeCheckpoint = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      // Clean up location data
      const newMap = new Map(checkpointLocations);
      newMap.delete(index);
      // Reindex remaining locations
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

    // Update location map
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

  const handleRouteChange = (routeId: string) => {
    const newRouteId = routeId;
    // If changing route, clear existing checkpoints first
    if (selectedRouteId && newRouteId !== selectedRouteId) {
      const currentPoints = form.getValues("points") || [];
      if (currentPoints.length > 0) {
        // Clear all checkpoints when route changes
        fields.forEach((_, index) => {
          remove(index);
        });
        setCheckpointLocations(new Map());
      }
    }
    setSelectedRouteId(newRouteId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <AcademicCapIcon className="h-8 w-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Create School Trip
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Create a scheduled trip linked to a school route for student transportation
          </p>
          {isDirty && (
            <p className="text-sm text-amber-600 mt-1">
              You have unsaved changes
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Step 1: School Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-semibold">
                  1
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Select School
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose the school for this trip
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <FormField
                label="School"
                required
                error={
                  !selectedSchoolId
                    ? { type: "manual", message: "School is required" }
                    : undefined
                }
              >
                <select
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                >
                  <option value="">Select a school</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
                {selectedSchool && (
                  <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-sm font-medium text-indigo-900">
                      {selectedSchool.name}
                    </p>
                    {selectedSchool.address && (
                      <p className="text-sm text-indigo-700 mt-1">
                        📍 {selectedSchool.address}
                      </p>
                    )}
                    {selectedSchool.phoneNumber && (
                      <p className="text-sm text-indigo-700 mt-1">
                        📞 {selectedSchool.phoneNumber}
                      </p>
                    )}
                  </div>
                )}
              </FormField>
            </CardContent>
          </Card>

          {/* Step 2: Trip Timing */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-semibold">
                  2
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Trip Date, Time & Type
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Set when the trip will occur and its type
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
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

                {/* Auto-generated trip name preview */}
                {generateTripName() && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Trip Name (Auto-generated)
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {generateTripName()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Route Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-semibold">
                  3
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Select School Route
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose a route for this trip. Stops will be automatically loaded as checkpoints.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FormField
                  label="School Route"
                  required
                  hint={
                    !selectedSchoolId
                      ? "Select a school first to see available routes"
                      : "Select a school route to enable stop and student tracking"
                  }
                  error={
                    !selectedRouteId
                      ? {
                          type: "manual",
                          message: "Route is required for school trips",
                        }
                      : undefined
                  }
                >
                  <select
                    value={selectedRouteId}
                    onChange={(e) => handleRouteChange(e.target.value)}
                    disabled={!selectedSchoolId}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!selectedSchoolId
                        ? "Select a school first"
                        : filteredRoutes.length === 0
                        ? "No routes available for this school"
                        : "Select a school route"}
                    </option>
                    {filteredRoutes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                        {route._count && (
                          <span className="text-gray-500">
                            {" "}
                            ({route._count.stops} stop
                            {route._count.stops !== 1 ? "s" : ""})
                          </span>
                        )}
                      </option>
                    ))}
                  </select>
                  {selectedRoute && (
                    <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <p className="text-sm font-medium text-indigo-900">
                        {selectedRoute.name}
                      </p>
                      {selectedRoute.description && (
                        <p className="text-sm text-indigo-700 mt-1">
                          {selectedRoute.description}
                        </p>
                      )}
                      {selectedRoute._count && (
                        <p className="text-sm text-indigo-700 mt-1">
                          📍 {selectedRoute._count.stops} stop
                          {selectedRoute._count.stops !== 1 ? "s" : ""} • 🚌{" "}
                          {selectedRoute._count.trips} trip
                          {selectedRoute._count.trips !== 1 ? "s" : ""} scheduled
                        </p>
                      )}
                    </div>
                  )}
                </FormField>

                {/* Route Planning Section - shown when route is selected */}
                {selectedRouteId && routeStops.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Route Stops ({routeStops.length})
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          These stops will be used as checkpoints for the trip
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={addCheckpoint}
                        icon={PlusIcon}
                        size="sm"
                        variant="outline"
                      >
                        Add Checkpoint
                      </Button>
                    </div>

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
                        const pointError =
                          form.formState.errors.points?.[index];

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
                                  variant="destructive"
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
                              {routeStops.length > 0 && (
                                <div>
                                  <FormField
                                    label="Link to Stop"
                                    hint="Link this checkpoint to a route stop to enable student tracking"
                                  >
                                    <select
                                      {...form.register(`points.${index}.stopId`)}
                                      onChange={(e) => {
                                        form.setValue(
                                          `points.${index}.stopId`,
                                          e.target.value
                                        );
                                        // Auto-fill location and name from stop
                                        if (e.target.value) {
                                          const stop = routeStops.find(
                                            (s) => s.id === e.target.value
                                          );
                                          if (stop) {
                                            form.setValue(
                                              `points.${index}.name`,
                                              stop.name
                                            );
                                            form.setValue(
                                              `points.${index}.latitude`,
                                              stop.latitude
                                            );
                                            form.setValue(
                                              `points.${index}.longitude`,
                                              stop.longitude
                                            );
                                            handleLocationChange(index, {
                                              latitude: stop.latitude,
                                              longitude: stop.longitude,
                                            });
                                          }
                                        }
                                      }}
                                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                                    >
                                      <option value="">No stop linked</option>
                                      {routeStops.map((stop) => (
                                        <option key={stop.id} value={stop.id}>
                                          Stop {stop.order + 1}: {stop.name}
                                          {stop._count?.students
                                            ? ` (${stop._count.students} student${
                                                stop._count.students !== 1
                                                  ? "s"
                                                  : ""
                                              })`
                                            : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </FormField>
                                  {form.watch(`points.${index}.stopId`) && (
                                    <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                      <p className="text-sm text-indigo-700">
                                        ✓ Linked to route stop - Students at this
                                        stop will receive location updates
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div>
                                <Controller
                                  control={form.control}
                                  name={`points.${index}.isFinalPoint`}
                                  render={({
                                    field: {
                                      value,
                                      onChange,
                                      onBlur,
                                      name,
                                      ref,
                                    },
                                  }) => (
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
                                    {...form.register(
                                      `points.${index}.expectedTime`
                                    )}
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
                                    {...form.register(
                                      `points.${index}.expectedTime`
                                    )}
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

                            {/* Employees Section */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <UserIcon className="h-5 w-5 text-indigo-600" />
                                  <h4 className="text-sm font-semibold text-gray-900">
                                    Employees at this checkpoint
                                  </h4>
                                  {(form.watch(`points.${index}.employees`)
                                    ?.length ?? 0) > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                      {
                                        form.watch(`points.${index}.employees`)
                                          ?.length ?? 0
                                      }
                                    </span>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  icon={PlusIcon}
                                  onClick={() => {
                                    const currentEmployees =
                                      form.getValues(
                                        `points.${index}.employees`
                                      ) || [];
                                    form.setValue(`points.${index}.employees`, [
                                      ...currentEmployees,
                                      { name: "", employeeId: "" },
                                    ]);
                                  }}
                                >
                                  Add Employee
                                </Button>
                              </div>

                              {(form.watch(`points.${index}.employees`)
                                ?.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                  {form
                                    .watch(`points.${index}.employees`)
                                    ?.map((employee: any, empIndex: number) => (
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
                                              value={employee.name || ""}
                                              onChange={(e) => {
                                                const employees =
                                                  form.getValues(
                                                    `points.${index}.employees`
                                                  ) || [];
                                                employees[empIndex] = {
                                                  ...employees[empIndex],
                                                  name: e.target.value,
                                                };
                                                form.setValue(
                                                  `points.${index}.employees`,
                                                  employees
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
                                              value={employee.employeeId || ""}
                                              onChange={(e) => {
                                                const employees =
                                                  form.getValues(
                                                    `points.${index}.employees`
                                                  ) || [];
                                                employees[empIndex] = {
                                                  ...employees[empIndex],
                                                  employeeId: e.target.value,
                                                };
                                                form.setValue(
                                                  `points.${index}.employees`,
                                                  employees
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
                                            const employees =
                                              form.getValues(
                                                `points.${index}.employees`
                                              ) || [];
                                            employees.splice(empIndex, 1);
                                            form.setValue(
                                              `points.${index}.employees`,
                                              employees
                                            );
                                          }}
                                          className="mt-6 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                                          title="Remove employee"
                                        >
                                          <XMarkIcon className="h-5 w-5" />
                                        </button>
                                      </div>
                                    ))}
                                </div>
                              )}

                              {(!form.watch(`points.${index}.employees`) ||
                                (form.watch(`points.${index}.employees`)
                                  ?.length ?? 0) === 0) && (
                                <p className="text-sm text-gray-500 italic">
                                  No employees added. Click "Add Employee" to add
                                  employees who should be picked up at this
                                  checkpoint.
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Captain Assignment */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-semibold">
                  4
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Assign Captain
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Optionally assign a captain (driver) to this trip. Can be assigned later.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <FormField
                label="Assign Captain"
                hint="Optional - can be assigned later. Search by phone number, name, or email."
                error={form.formState.errors.assignedCaptainId}
              >
                <Controller
                  control={form.control}
                  name="assignedCaptainId"
                  render={({ field, fieldState }) => (
                    <CaptainSelector
                      value={field.value}
                      onChange={(captainId) => {
                        field.onChange(captainId || "");
                      }}
                      error={fieldState.error}
                      disabled={isSubmitting}
                    />
                  )}
                />
              </FormField>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent>
              <div className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDraftSave}
                  disabled={!isDirty || isSubmitting}
                >
                  Save as Draft
                </Button>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !selectedSchoolId ||
                      !selectedRouteId ||
                      !form.watch("tripDate") ||
                      !form.watch("scheduledTime")
                    }
                    loading={isSubmitting}
                  >
                    {isSubmitting ? "Creating..." : "Create School Trip"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
