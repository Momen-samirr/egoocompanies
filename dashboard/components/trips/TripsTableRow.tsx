"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScheduledTrip } from "@/types/trip";
import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";
import StatusChangeModal from "./StatusChangeModal";
import TripEditModal from "./TripEditModal";
import TripQuickView from "./TripQuickView";
import {
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import { deriveTripFinance, formatCurrency } from "@/lib/utils/tripFinance";
import { useQueryClient } from "@tanstack/react-query";

interface TripsTableRowProps {
  trip: ScheduledTrip;
  index: number;
  onDelete?: (id: string) => void;
}

export default function TripsTableRow({ trip, index, onDelete }: TripsTableRowProps) {
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
          <div className="text-sm text-gray-900">
            {trip.company?.name || (
              <span className="text-gray-400 italic">No company</span>
            )}
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
          <div className="text-sm font-semibold text-gray-900">
            ${trip.price?.toFixed(2) ?? "0.00"}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div
            className={`text-sm font-semibold ${
              netIsPositive ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {formatCurrency(finance.netAmount)}
          </div>
          <div className="text-xs text-gray-500">{finance.ruleLabel}</div>
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
              onClick={() => setIsQuickViewOpen(true)}
            >
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowPathIcon}
              onClick={() => setIsStatusModalOpen(true)}
            >
              Status
            </Button>
            {(trip.status === "SCHEDULED" ||
              trip.status === "FAILED" ||
              trip.status === "ACTIVE") && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={PencilIcon}
                  onClick={() => setIsEditModalOpen(true)}
                >
                  Edit
                </Button>
                {(trip.status === "SCHEDULED" || trip.status === "FAILED") && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={TrashIcon}
                    onClick={() => handleDelete(trip.id)}
                  >
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

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

