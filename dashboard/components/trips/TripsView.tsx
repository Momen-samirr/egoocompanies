"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import TripsViewLayout from "./TripsViewLayout";
import TripsTable from "./TripsTable";
import Pagination from "@/components/common/Pagination";
import ExportButton from "@/components/common/ExportButton";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import { useTrips, TripView } from "@/hooks/useTrips";
import { useTripFilters } from "@/hooks/useTripFilters";
import { useTripPagination } from "@/hooks/useTripPagination";
import { TripSort } from "@/types/trip";
import { exportTripsToCSV } from "@/lib/utils/export";
import TripsStatsCards from "./TripsStatsCards";

interface TripsViewProps {
  view: TripView;
  title: string;
}

type SortField = "name" | "date" | "captain" | "checkpoints" | "status" | "createdAt";
type SortDirection = "asc" | "desc";

export default function TripsView({ view, title }: TripsViewProps) {
  const router = useRouter();
  const { filters, updateFilter, clearFilters, hasActiveFilters } = useTripFilters();
  const { page, pageSize, goToPage, changePageSize } = useTripPagination();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sort: TripSort | undefined = sortField
    ? { field: sortField, direction: sortDirection }
    : undefined;

  const { trips, pagination, isLoading, deleteTrip } = useTrips({
    view,
    filters,
    pagination: { page, pageSize },
    sort,
    search: searchQuery,
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field as SortField);
      setSortDirection("asc");
    }
    goToPage(1); // Reset to first page when sorting changes
  };

  const handleFilterChange = (newFilters: typeof filters) => {
    Object.keys(newFilters).forEach((key) => {
      updateFilter(key as keyof typeof filters, newFilters[key as keyof typeof filters]);
    });
    goToPage(1);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this trip?")) {
      deleteTrip(id);
    }
  };

  const handleExport = () => {
    if (trips.length === 0) {
      toast.error("No trips to export");
      return;
    }
    exportTripsToCSV(trips, `trips-${view}-${new Date().toISOString().split("T")[0]}.csv`);
    toast.success("Trips exported successfully");
  };

  return (
    <div className="space-y-6">
      <TripsViewLayout
        title={title}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={handleFilterChange}
        onClearFilters={clearFilters}
        actions={
          <ExportButton
            onClick={handleExport}
            disabled={isLoading || trips.length === 0}
          />
        }
      >
        {/* Stats Card */}
        <TripsStatsCards view={view} />

        {/* Results count */}
        {!isLoading && (
          <div className="text-sm text-gray-600">
            Showing {trips.length} of {pagination?.total || 0} trips
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" text="Loading trips..." />
          </div>
        ) : trips.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No trips match your filters" : `No ${title.toLowerCase()} found`}
            description={
              hasActiveFilters
                ? "Try adjusting your filters to see more results"
                : "Create your first scheduled trip to get started"
            }
            action={
              hasActiveFilters
                ? undefined
                : {
                    label: "Create Trip",
                    onClick: () => router.push("/dashboard/trips/create"),
                  }
            }
          />
        ) : (
          <>
            <TripsTable
              trips={trips}
              loading={isLoading}
              onDelete={handleDelete}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <Pagination
                  currentPage={page}
                  totalPages={pagination.pages}
                  totalItems={pagination.total}
                  pageSize={pageSize}
                  onPageChange={goToPage}
                  onPageSizeChange={changePageSize}
                />
              </div>
            )}
          </>
        )}
      </TripsViewLayout>
    </div>
  );
}

