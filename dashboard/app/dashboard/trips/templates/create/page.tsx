"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, Controller } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
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
} from "@heroicons/react/24/outline";
import { LocationData } from "@/types/trip";
import { Company } from "@/types";

// Template form schema (similar to trip but without dates/times)
const templateFormSchema = z.object({
  name: z
    .string()
    .min(3, "Template name must be at least 3 characters")
    .max(100, "Template name must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  tripType: z.enum(["ARRIVAL", "DEPARTURE"]),
  assignedCaptainId: z.string().optional(),
  companyId: z.string().min(1, "Company is required"),
  price: z
    .number({
      message: "Price must be a number",
    })
    .positive("Price must be greater than zero")
    .optional(),
  points: z
    .array(
      z.object({
        name: z.string().min(1, "Checkpoint name is required"),
        latitude: z.number(),
        longitude: z.number(),
        order: z.number().int().min(0),
        isFinalPoint: z.boolean(),
        expectedTime: z
          .string()
          .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
            message: "Invalid time format. Use HH:MM format",
          })
          .optional(),
        employees: z
          .array(
            z.object({
              name: z.string().max(100),
              employeeId: z.string().max(50).optional(),
            })
          )
          .optional(),
      })
    )
    .min(1, "At least one checkpoint is required")
    .max(20, "Maximum 20 checkpoints allowed")
    .refine(
      (points) => {
        const coordinates = points.map(
          (p) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`
        );
        return new Set(coordinates).size === coordinates.length;
      },
      {
        message: "Duplicate checkpoints are not allowed",
      }
    )
    .refine(
      (points) => {
        return points.some((p) => p.isFinalPoint);
      },
      {
        message: "At least one checkpoint must be marked as the final point",
      }
    ),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

export default function CreateTemplatePage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [checkpointLocations, setCheckpointLocations] = useState<
    Map<number, LocationData | null>
  >(new Map());

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      tripType: "DEPARTURE",
      companyId: "",
      price: undefined,
      points: [
        {
          name: "",
          latitude: 0,
          longitude: 0,
          order: 0,
          isFinalPoint: false,
          employees: [],
        },
      ],
    },
  });

  const companyIdRegister = form.register("companyId");

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "points",
  });

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await api.get("/admin/companies");
        setCompanies(response.data.companies || []);
      } catch (error) {
        console.error("Error fetching companies:", error);
        toast.error("Failed to load companies");
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (companies.length > 0 && !form.getValues("companyId")) {
      const defaultCompany = companies[0];
      form.setValue("companyId", defaultCompany.id, { shouldValidate: true });
      form.setValue("price", defaultCompany.defaultScheduledTripPrice, {
        shouldValidate: true,
      });
    }
  }, [companies, form]);

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
    const selectedCompany = companies.find(
      (company) => company.id === companyId
    );
    if (selectedCompany) {
      form.setValue("price", selectedCompany.defaultScheduledTripPrice, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const onSubmit = async (data: TemplateFormData) => {
    try {
      const response = await api.post("/admin/trip-templates", {
        name: data.name,
        description: data.description || null,
        tripType: data.tripType,
        assignedCaptainId: data.assignedCaptainId || undefined,
        companyId: data.companyId,
        price: data.price,
        points: data.points,
      });

      if (response.data.success) {
        toast.success("Template created successfully!");
        router.push("/dashboard/trips/templates");
      }
    } catch (error: any) {
      console.error("Error creating template:", error);
      toast.error(error.response?.data?.message || "Failed to create template");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Create Trip Template
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a reusable template for creating multiple trips
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={form.formState.isSubmitting}
        >
          Cancel
        </Button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                Basic Information
              </h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FormField
                  label="Template Name"
                  required
                  error={form.formState.errors.name}
                >
                  <input
                    type="text"
                    {...form.register("name")}
                    placeholder="e.g., Morning Route Template"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  />
                </FormField>

                <FormField
                  label="Description"
                  error={form.formState.errors.description}
                >
                  <textarea
                    {...form.register("description")}
                    placeholder="Optional description for this template"
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  />
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Trip Type"
                    required
                    error={form.formState.errors.tripType}
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
                  </FormField>
                </div>

                <FormField
                  label="Default Trip Price"
                  error={form.formState.errors.price}
                  hint="Optional - will use company default if not specified"
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
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                Assignment
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Optionally assign a default captain to trips created from this
                template
              </p>
            </CardHeader>
            <CardContent>
              <FormField
                label="Assign Captain"
                hint="Optional - can be assigned later"
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
                      disabled={form.formState.isSubmitting}
                    />
                  )}
                />
              </FormField>
            </CardContent>
          </Card>

          {/* Route Planning */}
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
            <CardContent>
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

                        <div>
                          <Controller
                            control={form.control}
                            name={`points.${index}.isFinalPoint`}
                            render={({
                              field: { value, onChange, onBlur, name, ref },
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

                      {/* Employees Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-5 w-5 text-indigo-600" />
                            <h4 className="text-sm font-semibold text-gray-900">
                              Employees at this checkpoint
                            </h4>
                            {(form.watch(`points.${index}.employees`)?.length ??
                              0) > 0 && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                {form.watch(`points.${index}.employees`)
                                  ?.length ?? 0}
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
                                form.getValues(`points.${index}.employees`) ||
                                [];
                              form.setValue(`points.${index}.employees`, [
                                ...currentEmployees,
                                { name: "", employeeId: "" },
                              ]);
                            }}
                          >
                            Add Employee
                          </Button>
                        </div>

                        {(form.watch(`points.${index}.employees`)?.length ??
                          0) > 0 && (
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
                          (form.watch(`points.${index}.employees`)?.length ??
                            0) === 0) && (
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
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={form.formState.isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  loading={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting
                    ? "Creating..."
                    : "Create Template"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
