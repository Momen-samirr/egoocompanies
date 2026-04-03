"use client";

import { ScheduledTrip } from "@/types/trip";
import {
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import TripsTableRow from "./TripsTableRow";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
  }
  return direction === "asc" ? (
    <ChevronUp className="h-4 w-4 text-primary" />
  ) : (
    <ChevronDown className="h-4 w-4 text-primary" />
  );
};

interface TripsTableProps {
  trips: ScheduledTrip[];
  loading?: boolean;
  onDelete?: (id: string) => void;
  sortField?: string | null;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string) => void;
  selectedTripIds?: Set<string>;
  onSelectTrip?: (tripId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
}

export default function TripsTable({
  trips,
  loading = false,
  onDelete,
  sortField,
  sortDirection = "asc",
  onSort,
  selectedTripIds = new Set(),
  onSelectTrip,
  onSelectAll,
}: TripsTableProps) {
  const handleSort = (field: string) => {
    onSort?.(field);
  };

  const allSelected = trips.length > 0 && trips.every((trip) => selectedTripIds.has(trip.id));
  const someSelected = trips.some((trip) => selectedTripIds.has(trip.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading trips...</div>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No trips found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/70">
            <TableHead className="w-12">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = someSelected && !allSelected;
                }}
                onChange={(e) => onSelectAll?.(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                aria-label="Select all trips"
              />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50 transition-colors"
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
            </TableHead>
            <TableHead>Company</TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50 transition-colors"
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
            </TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Net Amount</TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50 transition-colors"
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
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50 transition-colors"
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
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50 transition-colors"
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
            </TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.map((trip, index) => (
            <TripsTableRow
              key={trip.id}
              trip={trip}
              index={index}
              onDelete={onDelete}
              isSelected={selectedTripIds.has(trip.id)}
              onSelectChange={(selected) => onSelectTrip?.(trip.id, selected)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
