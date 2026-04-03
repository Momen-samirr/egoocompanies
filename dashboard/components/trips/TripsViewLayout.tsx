"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TripSearch from "@/components/trips/TripSearch";
import TripFilters from "@/components/trips/TripFilters";
import { Plus } from "lucide-react";
import { TripFilters as TripFiltersType } from "@/types/trip";

interface TripsViewLayoutProps {
  title: string;
  children: ReactNode;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: TripFiltersType;
  onFiltersChange: (filters: TripFiltersType) => void;
  onClearFilters: () => void;
  actions?: ReactNode;
  showCreateButton?: boolean;
}

export default function TripsViewLayout({
  title,
  children,
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  onClearFilters,
  actions,
  showCreateButton = true,
}: TripsViewLayoutProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1>
        <div className="flex items-center gap-3">
          {actions}
          {showCreateButton && (
            <>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/trips/create-school")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create School Trip
              </Button>
              <Button className="primary-gradient text-white" onClick={() => router.push("/dashboard/trips/create")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Trip
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="border border-slate-100">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Search */}
            <TripSearch
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search trips by name, captain, or checkpoint..."
            />

            {/* Filters */}
            <TripFilters
              filters={filters}
              onChange={onFiltersChange}
              onClear={onClearFilters}
            />

            {/* Content */}
            {children}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
