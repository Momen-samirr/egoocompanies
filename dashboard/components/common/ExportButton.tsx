"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(className)}
    >
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
}
