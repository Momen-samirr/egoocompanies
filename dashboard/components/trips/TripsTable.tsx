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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
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
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
