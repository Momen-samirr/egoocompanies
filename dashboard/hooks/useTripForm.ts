"use client";

import { useEffect, useCallback } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { tripFormSchema, TripFormData } from "@/lib/validations/trip.schema";
import { TripPoint } from "@/types/trip";

interface UseTripFormOptions {
  defaultValues?: Partial<TripFormData>;
  onSubmit: (data: TripFormData) => Promise<void>;
  onDraftSave?: (data: Partial<TripFormData>) => void;
}

export interface UseTripFormReturn {
  form: UseFormReturn<TripFormData>;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  handleDraftSave: () => void;
  isSubmitting: boolean;
  isDirty: boolean;
}

const DRAFT_STORAGE_KEY = "trip_form_draft";

export function useTripForm({
  defaultValues,
  onSubmit,
  onDraftSave,
}: UseTripFormOptions): UseTripFormReturn {
  const form = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: defaultValues || {
      name: "",
      tripDate: "",
      scheduledTime: "",
      assignedCaptainId: "",
      points: [
        {
          name: "",
          latitude: 0,
          longitude: 0,
          order: 0,
          isFinalPoint: false,
        },
      ],
    },
    mode: "onChange",
  });

  // Load draft from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft && !defaultValues) {
        try {
          const draft = JSON.parse(savedDraft);
          form.reset(draft);
        } catch (error) {
          console.error("Failed to load draft:", error);
        }
      }
    }
  }, []);

  // Auto-save draft on change
  useEffect(() => {
    if (form.formState.isDirty) {
      const subscription = form.watch((value) => {
        if (typeof window !== "undefined" && onDraftSave) {
          const timeoutId = setTimeout(() => {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(value));
            onDraftSave(value as Partial<TripFormData>);
          }, 1000); // Debounce auto-save

          return () => clearTimeout(timeoutId);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [form, onDraftSave]);

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await onSubmit(data);
      // Clear draft on successful submit
      if (typeof window !== "undefined") {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Form submission error:", error);
      throw error;
    }
  });

  const handleDraftSave = useCallback(() => {
    const currentValues = form.getValues();
    if (typeof window !== "undefined") {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(currentValues));
      onDraftSave?.(currentValues);
    }
  }, [form, onDraftSave]);

  return {
    form,
    handleSubmit,
    handleDraftSave,
    isSubmitting: form.formState.isSubmitting,
    isDirty: form.formState.isDirty,
  };
}

