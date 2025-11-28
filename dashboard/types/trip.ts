import { Company } from ".";

export type ScheduledTripStatus =
  | "SCHEDULED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "EMERGENCY_TERMINATED"
  | "EMERGENCY_ENDED"
  | "FORCE_CLOSED";

export type ScheduledTripFinancialStatus = "NONE" | "PAID" | "PENALIZED";

export type ScheduledTripFinancialRule =
  | "NONE"
  | "COMPLETED_FULL"
  | "FAILED_DOUBLE"
  | "EMERGENCY_DEDUCTION"
  | "FORCE_CLOSED_DEDUCTION";

export type TripType = "ARRIVAL" | "DEPARTURE";

export interface TripStatusHistory {
  id: string;
  scheduledTripId: string;
  previousStatus: ScheduledTripStatus;
  newStatus: ScheduledTripStatus;
  note?: string;
  changedBy: string;
  changedAt: string;
  changedByAdmin?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TripPoint {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  isFinalPoint: boolean;
  expectedTime?: string;
  reachedAt?: string;
}

export interface ScheduledTrip {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  status: ScheduledTripStatus;
  tripType?: TripType;
  assignedCaptainId?: string;
  createdById: string;
  companyId?: string;
  price?: number;
  financialStatus?: ScheduledTripFinancialStatus;
  financialRule?: ScheduledTripFinancialRule;
  financialAdjustment?: number;
  netAmount?: number;
  financialAppliedAt?: string;
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
  statusHistory?: TripStatusHistory[];
}

export interface TripFinanceBreakdown {
  trips: number;
  netAmount: number;
}

export interface TripFinanceSummary {
  range: {
    start: string;
    end: string;
  };
  totalTrips: number;
  netAmount: number;
  earnings: number;
  deductions: number;
  statusCounts: Record<string, TripFinanceBreakdown>;
  ruleBreakdown: Record<string, TripFinanceBreakdown>;
}

export interface TripInvoiceLineItem {
  ledgerId: string;
  tripId: string;
  tripName?: string;
  status: ScheduledTripStatus;
  rule: ScheduledTripFinancialRule;
  price: number;
  netAmount: number;
  calculatedAt: string;
  captain?: {
    id: string;
    name: string;
    phone_number: string;
    email: string;
  } | null;
  company?: {
    id: string;
    name: string;
  } | null;
}

export interface TripInvoice {
  range: {
    start: string;
    end: string;
  };
  totals: TripFinanceSummary;
  completedTrips: number;
  failedTrips: number;
  emergencyTrips: number;
  lineItems: TripInvoiceLineItem[];
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
  tripType: TripType;
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

