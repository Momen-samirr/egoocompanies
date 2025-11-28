"use client";

import Card, { CardBody } from "@/components/common/Card";
import { useTrips, TripView } from "@/hooks/useTrips";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import Link from "next/link";

interface TripsStatsCardsProps {
  view: TripView;
}

export default function TripsStatsCards({ view }: TripsStatsCardsProps) {
  const { trips, pagination, isLoading } = useTrips({
    view,
    pagination: { page: 1, pageSize: 1 }, // Just to get total count
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardBody>
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-8 bg-gray-200 rounded" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  const total = pagination?.total || 0;

  return (
    <Card>
      <CardBody>
        <div className="text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wide mb-2">
            Total {view === "all" ? "Trips" : view.charAt(0).toUpperCase() + view.slice(1) + " Trips"}
          </p>
          <p className="text-4xl font-bold text-gray-900">{total.toLocaleString()}</p>
        </div>
      </CardBody>
    </Card>
  );
}

interface OverviewStatsProps {
  upcomingCount: number;
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  emergencyCount: number;
  isLoading?: boolean;
}

export function OverviewStats({
  upcomingCount,
  activeCount,
  completedCount,
  cancelledCount,
  emergencyCount,
  isLoading = false,
}: OverviewStatsProps) {
  const stats = [
    {
      label: "Upcoming",
      value: upcomingCount,
      href: "/dashboard/trips/upcoming",
      color: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      label: "Active",
      value: activeCount,
      href: "/dashboard/trips/active",
      color: "bg-green-50 text-green-700 border-green-200",
    },
    {
      label: "Completed",
      value: completedCount,
      href: "/dashboard/trips/completed",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      label: "Cancelled",
      value: cancelledCount,
      href: "/dashboard/trips/cancelled",
      color: "bg-gray-50 text-gray-700 border-gray-200",
    },
    {
      label: "Emergency",
      value: emergencyCount,
      href: "/dashboard/trips/emergency",
      color: "bg-red-50 text-red-700 border-red-200",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardBody>
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-8 bg-gray-200 rounded" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <Link key={stat.label} href={stat.href}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardBody>
              <div className="text-center">
                <p className="text-sm text-gray-500 uppercase tracking-wide mb-2">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
              </div>
            </CardBody>
          </Card>
        </Link>
      ))}
    </div>
  );
}

