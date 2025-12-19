"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScheduledTrip } from "@/types/trip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/common/StatusBadge";
import StatusChangeModal from "./StatusChangeModal";
import TripEditModal from "./TripEditModal";
import TripQuickView from "./TripQuickView";
import { Eye, Pencil, Trash2, RotateCcw, Film } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { deriveTripFinance, formatCurrency } from "@/lib/utils/tripFinance";
import { useQueryClient } from "@tanstack/react-query";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface TripsTableRowProps {
  trip: ScheduledTrip;
  index: number;
  onDelete?: (id: string) => void;
}

export default function TripsTableRow({
  trip,
  index,
  onDelete,
}: TripsTableRowProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  const finance = deriveTripFinance(trip);
  const netIsPositive = finance.netAmount >= 0;

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this trip?")) {
      onDelete?.(id);
    }
  };

  const handleStatusChangeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["trips"] });
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["trips"] });
  };

  return (
    <>
      <TableRow
        className={cn(
          "transition-all duration-150",
          index % 2 === 0 ? "bg-background" : "bg-muted/30"
        )}
      >
        <TableCell className="whitespace-nowrap">
          <div className="text-sm font-semibold text-foreground">
            {trip.name}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="text-sm text-foreground">
            {trip.company?.name || (
              <span className="text-muted-foreground italic">No company</span>
            )}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="text-sm font-medium text-foreground">
            {new Date(trip.tripDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {new Date(trip.scheduledTime).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </div>
          <div className="text-xs text-muted-foreground/70 mt-1">
            {formatDistanceToNow(new Date(trip.scheduledTime), {
              addSuffix: true,
            })}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="text-sm font-semibold text-foreground">
            ${trip.price?.toFixed(2) ?? "0.00"}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div
            className={cn(
              "text-sm font-semibold",
              netIsPositive ? "text-emerald-600" : "text-rose-600"
            )}
          >
            {formatCurrency(finance.netAmount)}
          </div>
          <div className="text-xs text-muted-foreground">
            {finance.ruleLabel}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="text-sm font-medium text-foreground">
            {trip.assignedCaptain?.name || (
              <span className="text-muted-foreground italic font-normal">
                Not assigned
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <Badge variant="outline" className="text-xs">
            {trip.points?.length || 0} checkpoint
            {trip.points?.length !== 1 ? "s" : ""}
          </Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <StatusBadge status={trip.status} size="sm" />
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="flex items-center gap-2">
            {trip.status === "COMPLETED" && (
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  router.push(`/dashboard/trips/${trip.id}?tab=replay`)
                }
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Film className="h-4 w-4 mr-1" />
                Replay
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsQuickViewOpen(true)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsStatusModalOpen(true)}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Status
            </Button>
            {(trip.status === "SCHEDULED" ||
              trip.status === "FAILED" ||
              trip.status === "ACTIVE") && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                {(trip.status === "SCHEDULED" || trip.status === "FAILED") && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(trip.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Modals */}
      <StatusChangeModal
        trip={{
          id: trip.id,
          name: trip.name,
          status: trip.status,
        }}
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onSuccess={handleStatusChangeSuccess}
      />

      <TripEditModal
        trip={trip}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
      />

      <TripQuickView
        tripId={trip.id}
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
        onEdit={() => setIsEditModalOpen(true)}
      />
    </>
  );
}
