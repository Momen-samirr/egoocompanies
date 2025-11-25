"use client";

import { useState, useEffect, useCallback } from "react";
import Select, { MultiValue } from "react-select";
import { TripFilters as TripFiltersType, ScheduledTripStatus } from "@/types/trip";
import { FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/common/Button";
import api from "@/lib/api";

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
  { value: "EMERGENCY_TERMINATED", label: "Emergency Terminated" },
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
                handleFilterChange(
                  "companyId",
                  event.target.value || undefined
                )
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

