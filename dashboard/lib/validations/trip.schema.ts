import { z } from "zod";

// Location validation schema
export const locationSchema = z.object({
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  placeId: z.string().optional(),
});

// Trip point validation schema
export const tripPointSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(1, "Checkpoint name is required")
    .max(100, "Checkpoint name must be less than 100 characters"),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  order: z.number().int().min(0),
  isFinalPoint: z.boolean(),
  expectedTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: "Invalid time format. Use HH:MM format",
    })
    .optional(),
});

// Trip form validation schema
export const tripFormSchema = z
  .object({
    name: z
      .string()
      .min(3, "Trip name must be at least 3 characters")
      .max(100, "Trip name must be less than 100 characters"),
    tripDate: z.string().refine(
      (date) => {
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);
        return selectedDate >= today;
      },
      {
        message: "Trip date cannot be in the past",
      }
    ),
    scheduledTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: "Invalid time format. Use HH:MM format",
    }),
    tripType: z.enum(["ARRIVAL", "DEPARTURE"]),
    assignedCaptainId: z.string().optional(),
    companyId: z.string().min(1, "Company is required"),
    price: z
      .number({
        message: "Price must be a number",
      })
      .positive("Price must be greater than zero"),
    points: z
      .array(tripPointSchema)
      .min(1, "At least one checkpoint is required")
      .max(20, "Maximum 20 checkpoints allowed")
      .refine(
        (points) => {
          // Check for duplicate coordinates
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
          // At least one point must be marked as final
          return points.some((p) => p.isFinalPoint);
        },
        {
          message: "At least one checkpoint must be marked as the final point",
        }
      ),
  })
  .refine(
    (data) => {
      // Validate that scheduled time is not too far in the future (e.g., 1 year)
      // Compare dates only (ignore time) to avoid time-of-day issues
      const tripDate = new Date(data.tripDate);
      tripDate.setHours(0, 0, 0, 0);
      
      const oneYearFromNow = new Date();
      oneYearFromNow.setHours(0, 0, 0, 0);
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      
      // Allow dates up to and including 1 year from today
      return tripDate <= oneYearFromNow;
    },
    {
      message: "Trip date cannot be more than 1 year in the future",
      path: ["tripDate"],
    }
  )
  .refine(
    (data) => {
      // For ARRIVAL trips, all checkpoints must have expectedTime
      if (data.tripType === "ARRIVAL") {
        const missingExpectedTimes = data.points.filter(
          (p) => !p.expectedTime || p.expectedTime.trim() === ""
        );
        if (missingExpectedTimes.length > 0) {
          return false;
        }
      }
      return true;
    },
    {
      message: "For Arrival trips, all checkpoints must have an expected time",
      path: ["points"],
    }
  );

export type TripFormData = z.infer<typeof tripFormSchema>;
export type TripPointData = z.infer<typeof tripPointSchema>;
export type LocationData = z.infer<typeof locationSchema>;

