"use client";

import { TripTemplate } from "@/types/trip";
import Card, { CardBody } from "@/components/common/Card";
import {
  MapPinIcon,
  BuildingOfficeIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import Button from "@/components/common/Button";
import { PencilIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

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
      <CardBody>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {template.name}
              </h3>
              <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                {template.tripType}
              </span>
            </div>

            {template.description && (
              <p className="text-sm text-gray-600 mb-3">
                {template.description}
              </p>
            )}

            <div className="space-y-2 text-sm text-gray-600">
              {template.company && (
                <div className="flex items-center gap-2">
                  <BuildingOfficeIcon className="h-4 w-4" />
                  <span>{template.company.name}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4" />
                <span>
                  {template.points.length} checkpoint
                  {template.points.length !== 1 ? "s" : ""}
                </span>
              </div>

              {template.assignedCaptain && (
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span>{template.assignedCaptain.name}</span>
                </div>
              )}

              {template.price !== undefined && template.price !== null && (
                <div className="text-sm font-medium text-gray-900">
                  Price: ${template.price.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 ml-4">
            <Link
              href={`/dashboard/trips/templates/${template.id}/create-trips`}
            >
              <Button variant="primary" size="sm" icon={PlusIcon}>
                Create Trips
              </Button>
            </Link>
            <Link href={`/dashboard/trips/templates/${template.id}`}>
              <Button variant="secondary" size="sm" icon={PencilIcon}>
                Edit
              </Button>
            </Link>
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                icon={TrashIcon}
                onClick={() => {
                  if (
                    confirm("Are you sure you want to delete this template?")
                  ) {
                    onDelete(template.id);
                  }
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
