"use client";

import { useState, useEffect } from "react";
import {
  NotificationFilters as NotificationFiltersType,
  NotificationStatus,
} from "@/types";
import { FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/common/Button";

interface NotificationFiltersProps {
  filters: NotificationFiltersType;
  onChange: (filters: NotificationFiltersType) => void;
  onClear: () => void;
}

const documentTypeOptions = [
  { value: "selfie", label: "Selfie" },
  { value: "license_front", label: "License (Front)" },
  { value: "license_back", label: "License (Back)" },
  { value: "license", label: "License" },
  { value: "criminal_record", label: "Criminal Record" },
  { value: "drug_test", label: "Drug Test" },
];

const statusOptions = [
  { value: NotificationStatus.UNREAD, label: "Unread" },
  { value: NotificationStatus.READ, label: "Read" },
];

export default function NotificationFilters({
  filters,
  onChange,
  onClear,
}: NotificationFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] =
    useState<NotificationFiltersType>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const hasActiveFilters =
    localFilters.documentType ||
    localFilters.status ||
    localFilters.startDate ||
    localFilters.endDate ||
    localFilters.driverId;

  const handleFilterChange = <K extends keyof NotificationFiltersType>(
    key: K,
    value: NotificationFiltersType[K] | undefined
  ) => {
    const newFilters = { ...localFilters };
    if (value === undefined || value === "") {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    setLocalFilters(newFilters);
    onChange(newFilters);
  };

  const handleClear = () => {
    const clearedFilters: NotificationFiltersType = {
      page: 1,
      limit: 20,
    };
    setLocalFilters(clearedFilters);
    onClear();
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            hasActiveFilters
              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <FunnelIcon className="h-5 w-5" />
          <span className="text-sm font-medium">Filters</span>
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
              Active
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <XMarkIcon className="h-4 w-4" />
            Clear filters
          </button>
        )}
      </div>

      {showFilters && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Document Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Type
              </label>
              <select
                value={localFilters.documentType || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "documentType",
                    e.target.value || undefined
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Types</option>
                {documentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={localFilters.status || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "status",
                    (e.target.value as NotificationStatus) || undefined
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Status</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={localFilters.startDate || ""}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value || undefined)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* End Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={localFilters.endDate || ""}
                onChange={(e) =>
                  handleFilterChange("endDate", e.target.value || undefined)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Driver ID Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Driver ID
              </label>
              <input
                type="text"
                value={localFilters.driverId || ""}
                onChange={(e) =>
                  handleFilterChange("driverId", e.target.value || undefined)
                }
                placeholder="Enter driver ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
