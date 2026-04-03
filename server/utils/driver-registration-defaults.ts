import { VehicleType } from "@prisma/client";

/**
 * Maps client vehicle type strings to Prisma enum (registration flow may omit vehicle step).
 */
export function normalizeVehicleType(input: unknown): VehicleType {
  const s = String(input ?? "")
    .trim()
    .toLowerCase();
  if (s === "motorcycle") return VehicleType.Motorcycle;
  if (s === "cng") return VehicleType.CNG;
  return VehicleType.Car;
}

export type DriverRegistrationVehicleBody = {
  phone_number?: string;
  vehicle_type?: string;
  registration_number?: string;
  registration_date?: string;
  driving_license?: string;
  vehicle_color?: string;
  rate?: string;
};

/**
 * Fills vehicle / license placeholders when the app skips the vehicle registration step.
 * registration_number stays unique per phone via PENDING_REG_* until updated elsewhere.
 */
export function resolveDriverRegistrationVehicleFields(
  body: DriverRegistrationVehicleBody,
  normalizedPhone: string
): {
  vehicle_type: VehicleType;
  registration_number: string;
  registration_date: string;
  driving_license: string;
  vehicle_color: string | null;
  rate: string;
} {
  const digits = normalizedPhone.replace(/\D/g, "") || "unknown";
  const registration_number =
    body.registration_number?.trim() || `PENDING_REG_${digits}`;
  return {
    vehicle_type:
      body.vehicle_type != null && String(body.vehicle_type).trim() !== ""
        ? normalizeVehicleType(body.vehicle_type)
        : VehicleType.Car,
    registration_number,
    registration_date: body.registration_date?.trim() ?? "",
    driving_license: body.driving_license?.trim() || "pending",
    vehicle_color:
      body.vehicle_color != null && String(body.vehicle_color).trim() !== ""
        ? String(body.vehicle_color).trim()
        : null,
    rate:
      body.rate != null && String(body.rate).trim() !== ""
        ? String(body.rate).trim()
        : "0",
  };
}
