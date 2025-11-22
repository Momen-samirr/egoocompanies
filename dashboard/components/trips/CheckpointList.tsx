"use client";

import { Checkpoint } from "./TripTimeline";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { MapPinIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";

interface CheckpointListProps {
  checkpoints: Array<{
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    isFinalPoint: boolean;
  }>;
  onRemove?: (index: number) => void;
  onMove?: (index: number, direction: "up" | "down") => void;
  editable?: boolean;
}

export default function CheckpointList({ checkpoints, onRemove, onMove, editable = false }: CheckpointListProps) {
  return (
    <div className="space-y-3">
      {checkpoints.map((checkpoint, index) => (
        <Card key={index} className="transition-all hover:shadow-md">
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-sm">
                    {index + 1}
                  </span>
                  <h4 className="font-semibold text-gray-900">{checkpoint.name}</h4>
                  {checkpoint.isFinalPoint && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                      Final
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 ml-10">
                  <MapPinIcon className="h-4 w-4" />
                  <span>
                    {checkpoint.latitude.toFixed(6)}, {checkpoint.longitude.toFixed(6)}
                  </span>
                </div>
              </div>
              {editable && (
                <div className="flex items-center gap-2 ml-4">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => onMove?.(index, "up")}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUpIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onMove?.(index, "down")}
                      disabled={index === checkpoints.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={TrashIcon}
                    onClick={() => onRemove?.(index)}
                    disabled={checkpoints.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

