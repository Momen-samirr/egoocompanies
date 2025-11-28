"use client";

import { ScheduledTrip } from "@/types/trip";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  BarsArrowUpIcon,
} from "@heroicons/react/24/outline";
import TripsTableRow from "./TripsTableRow";

interface SortIndicatorProps {
  field: string;
  activeField?: string | null;
  direction: "asc" | "desc";
}

const SortIndicator = ({
  field,
  activeField,
  direction,
}: SortIndicatorProps) => {
  if (activeField !== field) {
    return <BarsArrowUpIcon className="h-4 w-4 text-gray-400" />;
  }
  return direction === "asc" ? (
    <ChevronUpIcon className="h-4 w-4 text-indigo-600" />
  ) : (
    <ChevronDownIcon className="h-4 w-4 text-indigo-600" />
  );
};

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
  const handleSort = (field: string) => {
    onSort?.(field);
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
                <SortIndicator
                  field="name"
                  activeField={sortField}
                  direction={sortDirection}
                />
              </div>
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
              Company
            </th>
            <th
              className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors group"
              onClick={() => handleSort("date")}
            >
              <div className="flex items-center gap-2">
                <span>Date & Time</span>
                <SortIndicator
                  field="date"
                  activeField={sortField}
                  direction={sortDirection}
                />
              </div>
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
              Price
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
              Net Amount
            </th>
            <th
              className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors group"
              onClick={() => handleSort("captain")}
            >
              <div className="flex items-center gap-2">
                <span>Captain</span>
                <SortIndicator
                  field="captain"
                  activeField={sortField}
                  direction={sortDirection}
                />
              </div>
            </th>
            <th
              className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors group"
              onClick={() => handleSort("checkpoints")}
            >
              <div className="flex items-center gap-2">
                <span>Checkpoints</span>
                <SortIndicator
                  field="checkpoints"
                  activeField={sortField}
                  direction={sortDirection}
                />
              </div>
            </th>
            <th
              className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors group"
              onClick={() => handleSort("status")}
            >
              <div className="flex items-center gap-2">
                <span>Status</span>
                <SortIndicator
                  field="status"
                  activeField={sortField}
                  direction={sortDirection}
                />
              </div>
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200/60">
          {trips.map((trip, index) => (
            <TripsTableRow
              key={trip.id}
              trip={trip}
              index={index}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
