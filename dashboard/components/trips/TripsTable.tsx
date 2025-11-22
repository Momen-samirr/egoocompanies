"use client";

import { useRouter } from "next/navigation";
import { ScheduledTrip } from "@/types/trip";
import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";
import {
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  BarsArrowUpIcon,
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

interface TripsTableProps {
  trips: ScheduledTrip[];
  loading?: boolean;
  onDelete?: (id: string) => void;
  sortField?: string | null;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string) => void;
}

export default function TripsTable({
  trips,
  loading = false,
  onDelete,
  sortField,
  sortDirection = "asc",
  onSort,
}: TripsTableProps) {
  const router = useRouter();

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return <BarsArrowUpIcon className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-indigo-600" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-indigo-600" />
    );
  };

  const handleSort = (field: string) => {
    onSort?.(field);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this trip?")) {
      onDelete?.(id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading trips...</div>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No trips found</p>
      </div>
    );
  }

  return (
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
          {trips.map((trip, index) => (
            <tr
              key={trip.id}
              className={`transition-all duration-150 ${
                index % 2 === 0
                  ? "bg-white hover:bg-indigo-50/40"
                  : "bg-gray-50/30 hover:bg-indigo-50/40"
              }`}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900">
                  {trip.name}
                </div>
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
                  {formatDistanceToNow(new Date(trip.scheduledTime), {
                    addSuffix: true,
                  })}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {trip.assignedCaptain?.name || (
                    <span className="text-gray-400 italic font-normal">
                      Not assigned
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {trip.points?.length || 0} checkpoint
                  {trip.points?.length !== 1 ? "s" : ""}
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
                  {(trip.status === "SCHEDULED" ||
                    trip.status === "FAILED") && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={PencilIcon}
                        onClick={() =>
                          router.push(`/dashboard/trips/${trip.id}/edit`)
                        }
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
  );
}

