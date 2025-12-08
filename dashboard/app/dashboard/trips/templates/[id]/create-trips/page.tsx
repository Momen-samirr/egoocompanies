"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import Card, { CardBody, CardHeader } from "@/components/common/Card";
import Button from "@/components/common/Button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import FormField from "@/components/common/FormField";
import { TripTemplate } from "@/types/trip";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

interface TripData {
  name: string;
  tripDate: string;
  scheduledTime: string;
  assignedCaptainId?: string;
  price?: number;
}

export default function CreateTripsFromTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [template, setTemplate] = useState<TripTemplate | null>(null);

  const form = useForm<{ trips: TripData[] }>({
    defaultValues: {
      trips: [
        {
          name: "",
          tripDate: "",
          scheduledTime: "",
          assignedCaptainId: "",
          price: undefined,
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
        setTemplate(response.data.template);

        // Set default name based on template
        const defaultName = response.data.template.name;
        form.setValue("trips.0.name", defaultName);
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
    append({
      name: template?.name || "",
      tripDate: "",
      scheduledTime: "",
      assignedCaptainId: "",
      price: undefined,
    });
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
          trips: data.trips.map((trip) => ({
            name: trip.name,
            tripDate: trip.tripDate,
            scheduledTime: trip.scheduledTime,
            assignedCaptainId: trip.assignedCaptainId || undefined,
            price: trip.price || undefined,
          })),
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
          variant="secondary"
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
                variant="secondary"
                size="sm"
                icon={PlusIcon}
                onClick={addTrip}
              >
                Add Trip
              </Button>
            </div>
          </CardHeader>
          <CardBody>
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
                        variant="danger"
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

                  <div className="mt-4 text-sm text-gray-600">
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
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
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
