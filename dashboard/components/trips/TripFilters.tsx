"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Select, { MultiValue } from "react-select";
import {
  TripFilters as TripFiltersType,
  ScheduledTripStatus,
} from "@/types/trip";
import { FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import {
  generateWeekOptions,
  getCurrentWeek,
  weekRangeToDateStrings,
  WeekRange,
} from "@/lib/utils/weekUtils";

interface CompanyOption {
  id: string;
  name: string;
}

interface TripFiltersProps {
  filters: TripFiltersType;
  onChange: (filters: TripFiltersType) => void;
  onClear: () => void;
}

type StatusOption = {
  value: ScheduledTripStatus;
  label: string;
};

const statusOptions: StatusOption[] = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "FAILED", label: "Failed" },
  { value: "EMERGENCY_ENDED", label: "Emergency Ended" },
  { value: "EMERGENCY_TERMINATED", label: "Emergency Terminated" },
  { value: "FORCE_CLOSED", label: "Force Closed" },
];

export default function TripFilters({
  filters,
  onChange,
  onClear,
}: TripFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<TripFiltersType>(filters);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await api.get("/admin/companies");
      setCompanies(response.data.companies || []);
    } catch (error) {
      console.error("Failed to load companies:", error);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const hasActiveFilters =
    (localFilters.status && localFilters.status.length > 0) ||
    localFilters.name ||
    localFilters.captain ||
    localFilters.companyId ||
    localFilters.checkpoints?.min !== undefined ||
    localFilters.checkpoints?.max !== undefined ||
    localFilters.dateRange?.start ||
    localFilters.dateRange?.end;

  const handleFilterChange = <K extends keyof TripFiltersType>(
    key: K,
    value: TripFiltersType[K] | undefined
  ) => {
    const newFilters = { ...localFilters };
    if (value === undefined) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    setLocalFilters(newFilters);
    onChange(newFilters);
  };

  const handleStatusChange = (selectedOptions: MultiValue<StatusOption>) => {
    const statuses = selectedOptions.map((opt) => opt.value);
    handleFilterChange("status", statuses.length > 0 ? statuses : undefined);
  };

  const handleClear = () => {
    setLocalFilters({});
    onClear();
  };

  // Generate week options
  const weekOptions = useMemo(() => {
    return generateWeekOptions(new Date(), 10, 10);
  }, []);

  // Find selected week based on dateRange
  const selectedWeek = useMemo(() => {
    if (!localFilters.dateRange?.start || !localFilters.dateRange?.end) {
      return null;
    }
    const startDate = new Date(localFilters.dateRange.start);
    const endDate = new Date(localFilters.dateRange.end);

    // Check if the date range matches a week range (Sunday-Saturday)
    return (
      weekOptions.find((week) => {
        const weekStartStr = week.start.toISOString().split("T")[0];
        const weekEndStr = week.end.toISOString().split("T")[0];
        return (
          weekStartStr === localFilters.dateRange?.start &&
          weekEndStr === localFilters.dateRange?.end
        );
      }) || null
    );
  }, [localFilters.dateRange, weekOptions]);

  const handleWeekChange = (week: WeekRange | null) => {
    if (week) {
      const dateStrings = weekRangeToDateStrings(week);
      handleFilterChange("dateRange", {
        start: dateStrings.start,
        end: dateStrings.end,
      });
    } else {
      // Clear week filter
      handleFilterChange("dateRange", undefined);
    }
  };

  const activeFilterCount = [
    localFilters.status?.length || 0,
    localFilters.name ? 1 : 0,
    localFilters.captain ? 1 : 0,
    localFilters.companyId ? 1 : 0,
    localFilters.checkpoints?.min !== undefined ||
    localFilters.checkpoints?.max !== undefined
      ? 1
      : 0,
    localFilters.dateRange?.start || localFilters.dateRange?.end ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Quick filter presets
  const applyQuickFilter = (preset: "today" | "thisWeek" | "thisMonth") => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate: string;
    let endDate: string = new Date().toISOString().split("T")[0];

    switch (preset) {
      case "today":
        startDate = today.toISOString().split("T")[0];
        break;
      case "thisWeek":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        startDate = weekStart.toISOString().split("T")[0];
        break;
      case "thisMonth":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        break;
      default:
        return;
    }

    handleFilterChange("dateRange", { start: startDate, end: endDate });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
              showFilters || hasActiveFilters
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Week Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">
              Week:
            </label>
            <Select<{ value: WeekRange; label: string }, false>
              options={weekOptions.map((week) => ({
                value: week,
                label: week.label,
              }))}
              value={
                selectedWeek
                  ? { value: selectedWeek, label: selectedWeek.label }
                  : null
              }
              onChange={(option) => handleWeekChange(option?.value || null)}
              placeholder="Select week..."
              isClearable
              className="text-sm min-w-[180px]"
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: "38px",
                  fontSize: "14px",
                }),
              }}
            />
          </div>

          {/* Quick Filter Presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Quick:</span>
            <button
              type="button"
              onClick={() => applyQuickFilter("today")}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyQuickFilter("thisWeek")}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => applyQuickFilter("thisMonth")}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              This Month
            </button>
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            icon={XMarkIcon}
          >
            Clear all
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Status
            </label>
            <Select<StatusOption, true>
              isMulti
              options={statusOptions}
              value={statusOptions.filter((opt) =>
                localFilters.status?.includes(opt.value)
              )}
              onChange={handleStatusChange}
              placeholder="Select statuses..."
              className="text-sm"
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: "38px",
                  fontSize: "14px",
                }),
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Trip Name
            </label>
            <input
              type="text"
              value={localFilters.name || ""}
              onChange={(e) =>
                handleFilterChange("name", e.target.value || undefined)
              }
              placeholder="Search by name..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Captain
            </label>
            <input
              type="text"
              value={localFilters.captain || ""}
              onChange={(e) =>
                handleFilterChange("captain", e.target.value || undefined)
              }
              placeholder="Search by captain..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Company
            </label>
            <select
              value={localFilters.companyId || ""}
              onChange={(event) =>
                handleFilterChange("companyId", event.target.value || undefined)
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
            >
              <option value="">All companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Checkpoints (Min)
            </label>
            <input
              type="number"
              min="0"
              value={localFilters.checkpoints?.min || ""}
              onChange={(e) =>
                handleFilterChange("checkpoints", {
                  ...localFilters.checkpoints,
                  min: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="Min checkpoints..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Checkpoints (Max)
            </label>
            <input
              type="number"
              min="0"
              value={localFilters.checkpoints?.max || ""}
              onChange={(e) =>
                handleFilterChange("checkpoints", {
                  ...localFilters.checkpoints,
                  max: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="Max checkpoints..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Trip Date (From)
            </label>
            <input
              type="date"
              value={localFilters.dateRange?.start || ""}
              onChange={(e) =>
                handleFilterChange("dateRange", {
                  ...localFilters.dateRange,
                  start: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Trip Date (To)
            </label>
            <input
              type="date"
              value={localFilters.dateRange?.end || ""}
              onChange={(e) =>
                handleFilterChange("dateRange", {
                  ...localFilters.dateRange,
                  end: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
