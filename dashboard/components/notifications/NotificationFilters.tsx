"use client";

import { useState } from "react";
import type {
  NotificationFilters,
  DocumentType,
  NotificationStatus,
} from "@/types";

interface NotificationFiltersProps {
  filters: NotificationFilters;
  onFiltersChange: (filters: NotificationFilters) => void;
}

const documentTypes: DocumentType[] = [
  "selfie",
  "license_front",
  "license_back",
  "drug_test",
  "criminal_record",
];

const documentTypeLabels: Record<DocumentType, string> = {
  selfie: "Selfie",
  license_front: "License Front",
  license_back: "License Back",
  drug_test: "Drug Test",
  criminal_record: "Criminal Record",
};

export default function NotificationFilters({
  filters,
  onFiltersChange,
}: NotificationFiltersProps) {
  const [localFilters, setLocalFilters] =
    useState<NotificationFilters>(filters);

  const handleChange = (key: keyof NotificationFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value, page: 1 };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleClear = () => {
    const clearedFilters: NotificationFilters = { page: 1, limit: 20 };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
        <button
          onClick={handleClear}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-4">
        {/* Document Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document Type
          </label>
          <select
            value={localFilters.documentType || ""}
            onChange={(e) =>
              handleChange("documentType", e.target.value || undefined)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="">All types</option>
            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {documentTypeLabels[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={localFilters.status || ""}
            onChange={(e) =>
              handleChange("status", e.target.value || undefined)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="">All statuses</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
          </select>
        </div>

        {/* Date Range Filters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={localFilters.startDate || ""}
              onChange={(e) =>
                handleChange("startDate", e.target.value || undefined)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={localFilters.endDate || ""}
              onChange={(e) =>
                handleChange("endDate", e.target.value || undefined)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
