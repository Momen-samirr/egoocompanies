"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Card, { CardBody } from "@/components/common/Card";
import Button from "@/components/common/Button";
import TripSearch from "@/components/trips/TripSearch";
import TripFilters from "@/components/trips/TripFilters";
import { PlusIcon } from "@heroicons/react/24/outline";
import { TripFilters as TripFiltersType } from "@/types/trip";

interface TripsViewLayoutProps {
  title: string;
  children: ReactNode;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: TripFiltersType;
  onFiltersChange: (filters: TripFiltersType) => void;
  onClearFilters: () => void;
  actions?: ReactNode;
  showCreateButton?: boolean;
}

export default function TripsViewLayout({
  title,
  children,
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  onClearFilters,
  actions,
  showCreateButton = true,
}: TripsViewLayoutProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-3">
          {actions}
          {showCreateButton && (
            <Button
              onClick={() => router.push("/dashboard/trips/create")}
              icon={PlusIcon}
            >
              Create Trip
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="space-y-6">
            {/* Search */}
            <TripSearch
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search trips by name, captain, or checkpoint..."
            />

            {/* Filters */}
            <TripFilters
              filters={filters}
              onChange={onFiltersChange}
              onClear={onClearFilters}
            />

            {/* Content */}
            {children}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

