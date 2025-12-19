"use client";

import { statusColors, StatusType } from "@/lib/design-system";
import {
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Info,
  PlayCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  completed: CheckCircle,
  active: PlayCircle,
  accepted: Info,
  "in progress": Info,
  pending: Clock,
  scheduled: Clock,
  cancelled: XCircle,
  failed: AlertTriangle,
  emergency_terminated: AlertTriangle,
  emergency_ended: AlertTriangle,
  force_closed: XCircle,
  inactive: XCircle,
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
  lg: "text-sm px-3 py-1.5",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export default function StatusBadge({
  status,
  size = "md",
  showIcon = true,
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, "_") as StatusType;
  const colorClass = statusColors[normalizedStatus] || statusColors.inactive;
  const Icon = statusIcons[normalizedStatus] || Info;

  const uppercaseValue = status.toUpperCase();
  const displayStatus =
    uppercaseValue === "EMERGENCY_TERMINATED" || uppercaseValue === "EMERGENCY_ENDED"
      ? "Emergency Ended"
      : uppercaseValue === "FORCE_CLOSED"
      ? "Force Closed"
      : toTitleCase(status);

  // Map status colors to badge variants
  const getVariant = () => {
    if (normalizedStatus === "completed" || normalizedStatus === "active") {
      return "default";
    }
    if (
      normalizedStatus === "cancelled" ||
      normalizedStatus === "failed" ||
      normalizedStatus === "emergency_terminated" ||
      normalizedStatus === "emergency_ended" ||
      normalizedStatus === "force_closed" ||
      normalizedStatus === "inactive"
    ) {
      return "destructive";
    }
    return "secondary";
  };

  return (
    <Badge
      variant={getVariant()}
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-full",
        sizeClasses[size],
        colorClass
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {displayStatus}
    </Badge>
  );
}
