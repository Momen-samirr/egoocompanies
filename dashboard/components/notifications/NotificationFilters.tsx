"use client";

import { useState, useEffect } from "react";
import {
  NotificationFilters as NotificationFiltersType,
  NotificationStatus,
} from "@/types";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
        <Button
          onClick={() => setShowFilters(!showFilters)}
          variant={hasActiveFilters ? "default" : "outline"}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1">
              Active
            </Badge>
          )}
        </Button>
        {hasActiveFilters && (
          <Button
            onClick={handleClear}
            variant="ghost"
            size="sm"
            className="gap-1"
          >
            <X className="h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>

      {showFilters && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Document Type Filter */}
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select
                  value={localFilters.documentType || "all"}
                  onValueChange={(value) =>
                    handleFilterChange("documentType", value === "all" ? undefined : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {documentTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={localFilters.status || "all"}
                  onValueChange={(value) =>
                    handleFilterChange(
                      "status",
                      value === "all" ? undefined : (value as NotificationStatus)
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Filter */}
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={localFilters.startDate || ""}
                  onChange={(e) =>
                    handleFilterChange("startDate", e.target.value || undefined)
                  }
                />
              </div>

              {/* End Date Filter */}
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={localFilters.endDate || ""}
                  onChange={(e) =>
                    handleFilterChange("endDate", e.target.value || undefined)
                  }
                />
              </div>

              {/* Driver ID Filter */}
              <div className="space-y-2">
                <Label>Driver ID</Label>
                <Input
                  type="text"
                  value={localFilters.driverId || ""}
                  onChange={(e) =>
                    handleFilterChange("driverId", e.target.value || undefined)
                  }
                  placeholder="Enter driver ID"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
