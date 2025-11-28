import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import api from "@/lib/api";
import { ScheduledTrip, TripFilters, TripSort, PaginationParams } from "@/types/trip";
import { Pagination as PaginationType } from "@/types";
import { toast } from "react-hot-toast";

export type TripView = "all" | "upcoming" | "active" | "completed" | "cancelled" | "emergency";

interface UseTripsOptions {
  view?: TripView;
  filters?: TripFilters;
  pagination?: {
    page: number;
    pageSize: number;
  };
  sort?: TripSort;
  search?: string;
  enabled?: boolean;
}

interface TripsResponse {
  trips: ScheduledTrip[];
  pagination: PaginationType;
}

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

// Map view to status filters
const getStatusFiltersForView = (view: TripView): ScheduledTrip["status"][] => {
  switch (view) {
    case "upcoming":
      return ["SCHEDULED"];
    case "active":
      return ["ACTIVE"];
    case "completed":
      return ["COMPLETED"];
    case "cancelled":
      return ["CANCELLED", "FAILED"];
    case "emergency":
      return ["EMERGENCY_TERMINATED", "EMERGENCY_ENDED"];
    default:
      return [];
  }
};

export function useTrips(options: UseTripsOptions = {}) {
  const {
    view = "all",
    filters = {},
    pagination = { page: 1, pageSize: 25 },
    sort,
    search,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();

  // Merge view-based status filters with user filters
  const viewStatuses = getStatusFiltersForView(view);
  const mergedFilters = useMemo(() => {
    const merged: TripFilters = { ...filters };
    
    if (viewStatuses.length > 0) {
      // If view has status filters, merge with user filters
      if (merged.status && merged.status.length > 0) {
        // Intersection: only show statuses that match both view and user filters
        merged.status = merged.status.filter((s) => viewStatuses.includes(s));
      } else {
        // If no user status filter, use view statuses
        merged.status = viewStatuses;
      }
    }
    
    return merged;
  }, [view, filters, viewStatuses]);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.pageSize.toString(),
    });

    // Add status filters
    if (mergedFilters.status && mergedFilters.status.length > 0) {
      mergedFilters.status.forEach((status) => {
        params.append("status", status);
      });
    }

    // Add other filters
    if (mergedFilters.name) params.append("name", mergedFilters.name);
    if (mergedFilters.captain) params.append("captain", mergedFilters.captain);
    if (mergedFilters.dateRange?.start) params.append("dateStart", mergedFilters.dateRange.start);
    if (mergedFilters.dateRange?.end) params.append("dateEnd", mergedFilters.dateRange.end);
    if (mergedFilters.companyId) params.append("companyId", mergedFilters.companyId);
    if (search) params.append("search", search);

    // Add sorting
    if (sort) {
      params.append("sortField", sort.field);
      params.append("sortDirection", sort.direction);
    }

    return params.toString();
  }, [mergedFilters, pagination, sort, search]);

  // Query key
  const queryKey = ["trips", view, mergedFilters, pagination, sort, search];

  // Fetch trips
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<TripsResponse>({
    queryKey,
    queryFn: async () => {
      const response = await api.get(`/admin/trips?${queryParams}`);
      return {
        trips: response.data.trips || [],
        pagination: response.data.pagination || {
          page: 1,
          limit: pagination.pageSize,
          total: 0,
          pages: 1,
        },
      };
    },
    enabled,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/trips/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Trip deleted successfully");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to delete trip"));
    },
  });

  return {
    trips: data?.trips || [],
    pagination: data?.pagination || null,
    isLoading,
    error,
    refetch,
    deleteTrip: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}

