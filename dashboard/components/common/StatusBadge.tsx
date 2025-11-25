"use client";

import { statusColors, StatusType } from "@/lib/design-system";
import { CheckCircleIcon, ClockIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, PlayCircleIcon } from "@heroicons/react/24/outline";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  completed: CheckCircleIcon,
  active: PlayCircleIcon,
  accepted: InformationCircleIcon,
  "in progress": InformationCircleIcon,
  pending: ClockIcon,
  scheduled: ClockIcon,
  cancelled: XCircleIcon,
  failed: ExclamationTriangleIcon,
  emergency_terminated: ExclamationTriangleIcon,
  emergency_ended: ExclamationTriangleIcon,
  force_closed: XCircleIcon,
  inactive: XCircleIcon,
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
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

export default function StatusBadge({ status, size = "md", showIcon = true }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, "_") as StatusType;
  const colorClass = statusColors[normalizedStatus] || statusColors.inactive;
  const Icon = statusIcons[normalizedStatus] || InformationCircleIcon;

  const uppercaseValue = status.toUpperCase();
  const displayStatus =
    uppercaseValue === "EMERGENCY_TERMINATED" || uppercaseValue === "EMERGENCY_ENDED"
      ? "Emergency Ended"
      : uppercaseValue === "FORCE_CLOSED"
      ? "Force Closed"
      : toTitleCase(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${colorClass} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {displayStatus}
    </span>
  );
}

