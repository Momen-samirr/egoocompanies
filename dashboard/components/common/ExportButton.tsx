"use client";

import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import Button from "./Button";

interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export default function ExportButton({
  onClick,
  disabled = false,
  className = "",
}: ExportButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={ArrowDownTrayIcon}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      Export CSV
    </Button>
  );
}

