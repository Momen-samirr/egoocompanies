"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import Card, { CardBody } from "@/components/common/Card";
import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import { 
  PlusIcon, 
  EyeIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  BarsArrowUpIcon
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

interface ScheduledTrip {
  id: string;
  name: string;
  tripDate: string;
  scheduledTime: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED" | "EMERGENCY_TERMINATED";
  assignedCaptain: {
    id: string;
    name: string;
    phone_number: string;
    email: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  points: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    isFinalPoint: boolean;
  }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

type SortField = "name" | "date" | "captain" | "checkpoints" | "status";
type SortDirection = "asc" | "desc";

export default function ScheduledTripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<ScheduledTrip[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [captainFilter, setCaptainFilter] = useState("");
  const [checkpointsFilter, setCheckpointsFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Sort states
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    fetchTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50", // Increased limit for client-side filtering
      });
      if (statusFilter) params.append("status", statusFilter);

      const response = await api.get(`/admin/trips?${params}`);
      setTrips(response.data.trips);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error("Error fetching scheduled trips:", error);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering and sorting
  const filteredAndSortedTrips = useMemo(() => {
    let filtered = [...trips];

    // Apply filters
    if (nameFilter) {
      filtered = filtered.filter((trip) =>
        trip.name.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    if (captainFilter) {
      filtered = filtered.filter((trip) =>
        trip.assignedCaptain?.name?.toLowerCase().includes(captainFilter.toLowerCase())
      );
    }

    if (checkpointsFilter) {
      const count = parseInt(checkpointsFilter);
      if (!isNaN(count)) {
        filtered = filtered.filter((trip) => (trip.points?.length || 0) === count);
      }
    }

    if (dateFilter) {
      filtered = filtered.filter((trip) => {
        const tripDate = new Date(trip.tripDate).toLocaleDateString();
        const filterDate = new Date(dateFilter).toLocaleDateString();
        return tripDate === filterDate;
      });
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

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
  }, [trips, nameFilter, captainFilter, checkpointsFilter, dateFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const clearFilters = () => {
    setNameFilter("");
    setCaptainFilter("");
    setCheckpointsFilter("");
    setDateFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const hasActiveFilters = nameFilter || captainFilter || checkpointsFilter || dateFilter || statusFilter;

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this trip?")) {
      return;
    }

    try {
      await api.delete(`/admin/trips/${id}`);
      fetchTrips();
    } catch (error) {
      console.error("Error deleting trip:", error);
      alert("Failed to delete trip");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <BarsArrowUpIcon className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-indigo-600" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-indigo-600" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Scheduled Trips</h1>
        <Button
          onClick={() => router.push("/dashboard/trips/create")}
          icon={PlusIcon}
        >
          Create Trip
        </Button>
      </div>

      <Card>
        <CardBody>
          {/* Filter Section */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                    showFilters || hasActiveFilters
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <FunnelIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">Filters</span>
                  {hasActiveFilters && (
                    <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                      {[nameFilter, captainFilter, checkpointsFilter, dateFilter, statusFilter].filter(Boolean).length}
                    </span>
                  )}
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    Clear all
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600">
                Showing {filteredAndSortedTrips.length} of {trips.length} trips
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Trip Name
                  </label>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      placeholder="Search by name..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Captain
                  </label>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={captainFilter}
                      onChange={(e) => setCaptainFilter(e.target.value)}
                      placeholder="Search by captain..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Checkpoints
                  </label>
                  <input
                    type="number"
                    value={checkpointsFilter}
                    onChange={(e) => setCheckpointsFilter(e.target.value)}
                    placeholder="Number of checkpoints..."
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  >
                    <option value="">All Status</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="FAILED">Failed</option>
                    <option value="EMERGENCY_TERMINATED">Emergency Terminated</option>
                  </select>
                </div>
              </div>
            )}
          </div>

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
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-b from-gray-50 via-gray-50 to-gray-100/80 border-b-2 border-gray-200">
                    <tr>
                      <th
                        className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors group"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-2">
                          <span>Trip Name</span>
                          <SortIcon field="name" />
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors group"
                        onClick={() => handleSort("date")}
                      >
                        <div className="flex items-center gap-2">
                          <span>Date & Time</span>
                          <SortIcon field="date" />
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors group"
                        onClick={() => handleSort("captain")}
                      >
                        <div className="flex items-center gap-2">
                          <span>Captain</span>
                          <SortIcon field="captain" />
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors group"
                        onClick={() => handleSort("checkpoints")}
                      >
                        <div className="flex items-center gap-2">
                          <span>Checkpoints</span>
                          <SortIcon field="checkpoints" />
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors group"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center gap-2">
                          <span>Status</span>
                          <SortIcon field="status" />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200/60">
                    {filteredAndSortedTrips.map((trip, index) => (
                      <tr
                        key={trip.id}
                        className={`transition-all duration-150 ${
                          index % 2 === 0
                            ? "bg-white hover:bg-indigo-50/40"
                            : "bg-gray-50/30 hover:bg-indigo-50/40"
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{trip.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(trip.tripDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(trip.scheduledTime).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(trip.scheduledTime), { addSuffix: true })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {trip.assignedCaptain?.name || (
                              <span className="text-gray-400 italic font-normal">Not assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {trip.points?.length || 0} checkpoint{trip.points?.length !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={trip.status} size="sm" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={EyeIcon}
                              onClick={() => router.push(`/dashboard/trips/${trip.id}`)}
                            >
                              View
                            </Button>
                            {(trip.status === "SCHEDULED" || trip.status === "FAILED") && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={PencilIcon}
                                  onClick={() => router.push(`/dashboard/trips/${trip.id}/edit`)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  icon={TrashIcon}
                                  onClick={() => handleDelete(trip.id)}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination && pagination.pages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="text-sm text-gray-700">
                    Showing {((page - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(page * pagination.limit, pagination.total)} of{" "}
                    {pagination.total} results
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= pagination.pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
