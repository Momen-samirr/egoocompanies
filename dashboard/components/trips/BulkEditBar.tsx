"use client";

import { Button } from "@/components/ui/button";
import { Pencil, X, CheckCircle2 } from "lucide-react";

interface BulkEditBarProps {
  selectedCount: number;
  onEdit: () => void;
  onDeselectAll: () => void;
}

export default function BulkEditBar({
  selectedCount,
  onEdit,
  onDeselectAll,
}: BulkEditBarProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4 gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedCount} trip{selectedCount !== 1 ? "s" : ""} selected
                  </span>
                  <span className="text-xs text-gray-500">
                    Ready to edit
                  </span>
                </div>
              </div>
              <div className="hidden sm:block h-6 w-px bg-gray-300" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onDeselectAll}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Clear Selection</span>
                <span className="sm:hidden">Clear</span>
              </Button>
            </div>
            <Button
              variant="default"
              size="default"
              onClick={onEdit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md transition-all duration-200 font-medium"
            >
              <Pencil className="h-4 w-4" />
              Edit Selected
            </Button>
          </div>
        </div>
      </div>
  );
}

