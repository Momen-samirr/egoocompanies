import { useState, useCallback, useMemo } from "react";
import { TripFilters } from "@/types/trip";

export function useTripFilters(initialFilters: TripFilters = {}) {
  const [filters, setFilters] = useState<TripFilters>(initialFilters);

  const updateFilter = useCallback(<K extends keyof TripFilters>(
    key: K,
    value: TripFilters[K] | undefined
  ) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }
      return newFilters;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.status && filters.status.length > 0) ||
      !!filters.name ||
      !!filters.captain ||
      !!filters.companyId ||
      filters.checkpoints?.min !== undefined ||
      filters.checkpoints?.max !== undefined ||
      !!filters.dateRange?.start ||
      !!filters.dateRange?.end
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    return [
      filters.status?.length || 0,
      filters.name ? 1 : 0,
      filters.captain ? 1 : 0,
      filters.companyId ? 1 : 0,
      filters.checkpoints?.min !== undefined || filters.checkpoints?.max !== undefined ? 1 : 0,
      filters.dateRange?.start || filters.dateRange?.end ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
  }, [filters]);

  return {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}

