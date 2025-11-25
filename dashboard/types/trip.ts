import { Company } from ".";

export type ScheduledTripStatus =
  | "SCHEDULED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "EMERGENCY_TERMINATED";

export interface TripPoint {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  isFinalPoint: boolean;
  reachedAt?: string;
}

export interface ScheduledTrip {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  status: ScheduledTripStatus;
  assignedCaptainId?: string;
  createdById: string;
  companyId?: string;
  price?: number;
  emergencyTerminatedAt?: string;
  emergencyTerminatedBy?: string;
  createdAt: string;
  updatedAt: string;
  assignedCaptain?: {
    id: string;
    name: string;
    phone_number: string;
    email: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  company?: Company;
  points: TripPoint[];
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  placeId?: string;
}

export interface TripFormData {
  name: string;
  tripDate: string;
  scheduledTime: string;
  assignedCaptainId?: string;
  companyId: string;
  price: number;
  points: TripPoint[];
}

export interface TripFilters {
  status?: ScheduledTripStatus[];
  name?: string;
  captain?: string;
  companyId?: string;
  checkpoints?: {
    min?: number;
    max?: number;
  };
  dateRange?: {
    start?: string;
    end?: string;
  };
  createdBy?: string;
  createdDateRange?: {
    start?: string;
    end?: string;
  };
}

export interface TripSort {
  field: "name" | "date" | "captain" | "checkpoints" | "status" | "createdAt";
  direction: "asc" | "desc";
}

export interface PaginationParams {
  page: number;
  limit: number;
  sort?: TripSort;
  filters?: TripFilters;
  search?: string;
}

