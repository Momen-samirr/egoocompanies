"use client";

import { TripTemplate } from "@/types/trip";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, User, Pencil, Trash2, Plus } from "lucide-react";
import Link from "next/link";

interface TripTemplateCardProps {
  template: TripTemplate;
  onDelete?: (id: string) => void;
}

export default function TripTemplateCard({
  template,
  onDelete,
}: TripTemplateCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-foreground">
                {template.name}
              </h3>
              <Badge variant="outline" className="text-xs">
                {template.tripType}
              </Badge>
            </div>

            {template.description && (
              <p className="text-sm text-muted-foreground mb-3">
                {template.description}
              </p>
            )}

            <div className="space-y-2 text-sm text-muted-foreground">
              {template.company && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>{template.company.name}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>
                  {template.points.length} checkpoint
                  {template.points.length !== 1 ? "s" : ""}
                </span>
              </div>

              {template.assignedCaptain && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{template.assignedCaptain.name}</span>
                </div>
              )}

              {template.price !== undefined && template.price !== null && (
                <div className="text-sm font-medium text-foreground">
                  Price: ${template.price.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 ml-4">
            <Link
              href={`/dashboard/trips/templates/${template.id}/create-trips`}
            >
              <Button variant="default" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Create Trips
              </Button>
            </Link>
            <Link href={`/dashboard/trips/templates/${template.id}`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </Link>
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (
                    confirm("Are you sure you want to delete this template?")
                  ) {
                    onDelete(template.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
