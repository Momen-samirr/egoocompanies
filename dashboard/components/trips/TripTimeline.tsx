"use client";

import { CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { CheckCircleIcon as CheckCircleOutlineIcon } from "@heroicons/react/24/outline";

interface Checkpoint {
  id: string;
  name: string;
  order: number;
  isFinalPoint: boolean;
  reachedAt: string | null;
}

interface TripTimelineProps {
  checkpoints: Checkpoint[];
  currentPointIndex?: number;
  status: string;
}

export default function TripTimeline({ checkpoints, currentPointIndex = -1, status }: TripTimelineProps) {
  const isActive = status === "ACTIVE";
  const isCompleted = status === "COMPLETED";

  return (
    <div className="space-y-4">
      {checkpoints.map((checkpoint, index) => {
        const isReached = checkpoint.reachedAt !== null;
        const isCurrent = isActive && index === currentPointIndex;
        const isPast = index < currentPointIndex || isReached || isCompleted;

        let icon;
        let bgColor;
        let borderColor;
        let textColor;

        if (isCompleted || isReached) {
          icon = <CheckCircleIcon className="h-6 w-6 text-green-600" />;
          bgColor = "bg-green-50";
          borderColor = "border-green-500";
          textColor = "text-green-900";
        } else if (isCurrent) {
          icon = <ClockIcon className="h-6 w-6 text-blue-600 animate-pulse" />;
          bgColor = "bg-blue-50";
          borderColor = "border-blue-500";
          textColor = "text-blue-900";
        } else {
          icon = <CheckCircleOutlineIcon className="h-6 w-6 text-gray-400" />;
          bgColor = "bg-gray-50";
          borderColor = "border-gray-300";
          textColor = "text-gray-600";
        }

        return (
          <div key={checkpoint.id} className="flex items-start space-x-4">
            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center h-12 w-12 rounded-full border-2 ${borderColor} ${bgColor} transition-all duration-200`}>
                {icon}
              </div>
              {index < checkpoints.length - 1 && (
                <div className={`w-0.5 h-12 ${isPast ? "bg-green-500" : "bg-gray-300"} transition-colors duration-200`} />
              )}
            </div>
            <div className={`flex-1 pb-8 ${index < checkpoints.length - 1 ? "border-b border-gray-200" : ""}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`font-semibold ${textColor}`}>
                    {index + 1}. {checkpoint.name}
                  </h4>
                  {checkpoint.isFinalPoint && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                      Final Point
                    </span>
                  )}
                </div>
                {isCurrent && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 animate-pulse">
                    Current
                  </span>
                )}
              </div>
              {checkpoint.reachedAt && (
                <p className="text-sm text-gray-500 mt-1">
                  Reached: {new Date(checkpoint.reachedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

