"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import Card, { CardBody } from "@/components/common/Card";
import Button from "@/components/common/Button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import TripsTable from "@/components/trips/TripsTable";
import TripFilters from "@/components/trips/TripFilters";
import TripSearch from "@/components/trips/TripSearch";
import Pagination from "@/components/common/Pagination";
import ExportButton from "@/components/common/ExportButton";
import { PlusIcon } from "@heroicons/react/24/outline";
import { ScheduledTrip, TripFilters as TripFiltersType, TripSort } from "@/types/trip";
import { Pagination as PaginationType } from "@/types";
import { exportTripsToCSV } from "@/lib/utils/export";

type SortField = "name" | "date" | "captain" | "checkpoints" | "status";
type SortDirection = "asc" | "desc";

export default function ScheduledTripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<ScheduledTrip[]>([]);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<TripFiltersType>({});
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    fetchTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters, sortField, sortDirection, searchQuery]);

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

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      // Add filters to params
      if (filters.status && filters.status.length > 0) {
        filters.status.forEach((status) => {
          params.append("status", status);
        });
      }
      if (filters.name) params.append("name", filters.name);
      if (filters.captain) params.append("captain", filters.captain);
      if (filters.dateRange?.start) params.append("dateStart", filters.dateRange.start);
      if (filters.dateRange?.end) params.append("dateEnd", filters.dateRange.end);
      if (filters.companyId) params.append("companyId", filters.companyId);
      if (searchQuery) params.append("search", searchQuery);

      const response = await api.get(`/admin/trips?${params.toString()}`);
      setTrips(response.data.trips || []);
      setPagination(response.data.pagination || {
        page: 1,
        limit: pageSize,
        total: 0,
        pages: 1,
      });
    } catch (error) {
      console.error("Error fetching scheduled trips:", error);
      toast.error(getErrorMessage(error, "Failed to load trips"));
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering and sorting for search
  const filteredAndSortedTrips = useMemo(() => {
    let filtered = [...trips];

    // Apply client-side search if needed (for checkpoint names, etc.)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((trip) => {
        const matchesName = trip.name.toLowerCase().includes(query);
        const matchesCaptain = trip.assignedCaptain?.name?.toLowerCase().includes(query);
        const matchesCompany = trip.company?.name?.toLowerCase().includes(query);
        const matchesCheckpoints = trip.points?.some((point) =>
          point.name.toLowerCase().includes(query)
        );
        return matchesName || matchesCaptain || matchesCompany || matchesCheckpoints;
      });
    }

    // Apply client-side filters
    if (filters.checkpoints?.min !== undefined) {
      filtered = filtered.filter(
        (trip) => (trip.points?.length || 0) >= filters.checkpoints!.min!
      );
    }
    if (filters.checkpoints?.max !== undefined) {
      filtered = filtered.filter(
        (trip) => (trip.points?.length || 0) <= filters.checkpoints!.max!
      );
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortField) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "date":
            aValue = new Date(a.scheduledTime).getTime();
            bValue = new Date(b.scheduledTime).getTime();
            break;
          case "captain":
            aValue = (a.assignedCaptain?.name || "").toLowerCase();
            bValue = (b.assignedCaptain?.name || "").toLowerCase();
            break;
          case "checkpoints":
            aValue = a.points?.length || 0;
            bValue = b.points?.length || 0;
            break;
          case "status":
            aValue = a.status;
            bValue = b.status;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [trips, searchQuery, filters, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field as SortField);
      setSortDirection("asc");
    }
  };

  const handleFilterChange = (newFilters: TripFiltersType) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const handleClearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/trips/${id}`);
      toast.success("Trip deleted successfully");
      fetchTrips();
    } catch (error) {
      console.error("Error deleting trip:", error);
      toast.error(getErrorMessage(error, "Failed to delete trip"));
    }
  };

  const handleExport = () => {
    if (filteredAndSortedTrips.length === 0) {
      toast.error("No trips to export");
      return;
    }
    exportTripsToCSV(filteredAndSortedTrips, `trips-${new Date().toISOString().split("T")[0]}.csv`);
    toast.success("Trips exported successfully");
  };

  const hasActiveFilters = Object.keys(filters).length > 0 || searchQuery;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Scheduled Trips</h1>
        <div className="flex items-center gap-3">
          <ExportButton onClick={handleExport} disabled={loading || filteredAndSortedTrips.length === 0} />
          <Button
            onClick={() => router.push("/dashboard/trips/create")}
            icon={PlusIcon}
          >
            Create Trip
          </Button>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="space-y-6">
            {/* Search */}
            <TripSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search trips by name, captain, or checkpoint..."
            />

            {/* Filters */}
            <TripFilters
              filters={filters}
              onChange={handleFilterChange}
              onClear={handleClearFilters}
            />

            {/* Results count */}
            {!loading && (
              <div className="text-sm text-gray-600">
                Showing {filteredAndSortedTrips.length} of{" "}
                {pagination?.total || trips.length} trips
              </div>
            )}

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" text="Loading trips..." />
              </div>
            ) : filteredAndSortedTrips.length === 0 ? (
              <EmptyState
                title={hasActiveFilters ? "No trips match your filters" : "No scheduled trips found"}
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
                  trips={filteredAndSortedTrips}
                  loading={loading}
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
                      onPageChange={setPage}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
