"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Trash2, ArrowUp, ArrowDown, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckpointListProps {
  checkpoints: Array<{
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    isFinalPoint: boolean;
    employees?: Array<{ name: string; employeeId?: string }>;
  }>;
  onRemove?: (index: number) => void;
  onMove?: (index: number, direction: "up" | "down") => void;
  editable?: boolean;
}

export default function CheckpointList({
  checkpoints,
  onRemove,
  onMove,
  editable = false,
}: CheckpointListProps) {
  return (
    <div className="space-y-3">
      {checkpoints.map((checkpoint, index) => (
        <Card key={index} className="transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {index + 1}
                  </span>
                  <h4 className="font-semibold text-foreground">
                    {checkpoint.name}
                  </h4>
                  {checkpoint.isFinalPoint && (
                    <Badge variant="outline" className="text-xs">
                      Final
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground ml-10">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {checkpoint.latitude.toFixed(6)},{" "}
                    {checkpoint.longitude.toFixed(6)}
                  </span>
                </div>
                {checkpoint.employees && checkpoint.employees.length > 0 && (
                  <div className="mt-2 ml-10">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="font-medium">
                        {checkpoint.employees.length} employee
                        {checkpoint.employees.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {checkpoint.employees.map((emp, empIndex) => (
                        <Badge
                          key={empIndex}
                          variant="outline"
                          className="text-xs"
                        >
                          {emp.name}
                          {emp.employeeId && (
                            <span className="ml-1 text-muted-foreground">
                              ({emp.employeeId})
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {editable && (
                <div className="flex items-center gap-2 ml-4">
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onMove?.(index, "up")}
                      disabled={index === 0}
                      className="h-6 w-6"
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onMove?.(index, "down")}
                      disabled={index === checkpoints.length - 1}
                      className="h-6 w-6"
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRemove?.(index)}
                    disabled={checkpoints.length === 1}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
