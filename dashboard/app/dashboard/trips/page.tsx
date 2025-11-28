"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import Card, { CardBody, CardHeader } from "@/components/common/Card";
import Button from "@/components/common/Button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { PlusIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { ScheduledTrip, TripFinanceSummary } from "@/types/trip";
import TripFinanceSummaryCards from "@/components/trips/TripFinanceSummaryCards";
import { OverviewStats } from "@/components/trips/TripsStatsCards";
import { useTrips } from "@/hooks/useTrips";
import Link from "next/link";
import StatusBadge from "@/components/common/StatusBadge";
import { formatDistanceToNow } from "date-fns";

export default function ScheduledTripsOverviewPage() {
  const router = useRouter();
  const [financeSummary, setFinanceSummary] = useState<{
    today?: TripFinanceSummary;
    lastTwoWeeks?: TripFinanceSummary;
  }>({});
  const [financeSummaryLoading, setFinanceSummaryLoading] = useState(true);
  const [recentTrips, setRecentTrips] = useState<ScheduledTrip[]>([]);
  const [recentTripsLoading, setRecentTripsLoading] = useState(true);

  // Fetch counts for each view
  const { pagination: upcomingPagination, isLoading: upcomingLoading } = useTrips({
    view: "upcoming",
    pagination: { page: 1, pageSize: 1 },
  });
  const { pagination: activePagination, isLoading: activeLoading } = useTrips({
    view: "active",
    pagination: { page: 1, pageSize: 1 },
  });
  const { pagination: completedPagination, isLoading: completedLoading } = useTrips({
    view: "completed",
    pagination: { page: 1, pageSize: 1 },
  });
  const { pagination: cancelledPagination, isLoading: cancelledLoading } = useTrips({
    view: "cancelled",
    pagination: { page: 1, pageSize: 1 },
  });
  const { pagination: emergencyPagination, isLoading: emergencyLoading } = useTrips({
    view: "emergency",
    pagination: { page: 1, pageSize: 1 },
  });

  useEffect(() => {
    fetchFinanceSummary();
    fetchRecentTrips();
  }, []);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
        "string"
    ) {
      return (
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        fallback
      );
    }
    return fallback;
  };

  const fetchFinanceSummary = async () => {
    try {
      setFinanceSummaryLoading(true);
      const response = await api.get("/admin/trips/earnings/summary");
      setFinanceSummary(response.data.summary || {});
    } catch (error) {
      console.error("Error fetching finance summary:", error);
      toast.error(getErrorMessage(error, "Failed to load earnings summary"));
    } finally {
      setFinanceSummaryLoading(false);
    }
  };

  const fetchRecentTrips = async () => {
    try {
      setRecentTripsLoading(true);
      const response = await api.get("/admin/trips?page=1&limit=10&sortField=createdAt&sortDirection=desc");
      setRecentTrips(response.data.trips || []);
    } catch (error) {
      console.error("Error fetching recent trips:", error);
    } finally {
      setRecentTripsLoading(false);
    }
  };

  const isLoading =
    upcomingLoading ||
    activeLoading ||
    completedLoading ||
    cancelledLoading ||
    emergencyLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Scheduled Trips</h1>
        <Button
          onClick={() => router.push("/dashboard/trips/create")}
          icon={PlusIcon}
        >
          Create Trip
        </Button>
      </div>

      {/* Overview Stats */}
      <OverviewStats
        upcomingCount={upcomingPagination?.total || 0}
        activeCount={activePagination?.total || 0}
        completedCount={completedPagination?.total || 0}
        cancelledCount={cancelledPagination?.total || 0}
        emergencyCount={emergencyPagination?.total || 0}
        isLoading={isLoading}
      />

      {/* Finance Summary */}
      <TripFinanceSummaryCards
        today={financeSummary.today}
        lastTwoWeeks={financeSummary.lastTwoWeeks}
        loading={financeSummaryLoading}
      />

      {/* Recent Trips */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Recent Trips</h2>
            <Link href="/dashboard/trips/upcoming">
              <Button variant="ghost" size="sm" icon={ArrowRightIcon} iconPosition="right">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardBody>
          {recentTripsLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading recent trips..." />
            </div>
          ) : recentTrips.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No recent trips</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trip Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Captain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{trip.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(trip.scheduledTime).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(trip.scheduledTime), {
                            addSuffix: true,
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {trip.assignedCaptain?.name || (
                            <span className="text-gray-400 italic">Not assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={trip.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/dashboard/trips/${trip.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/dashboard/trips/upcoming">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Upcoming Trips</h3>
                  <p className="text-sm text-gray-500 mt-1">View scheduled trips</p>
                </div>
                <ArrowRightIcon className="h-6 w-6 text-gray-400" />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/dashboard/trips/active">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Active Trips</h3>
                  <p className="text-sm text-gray-500 mt-1">Monitor ongoing trips</p>
                </div>
                <ArrowRightIcon className="h-6 w-6 text-gray-400" />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/dashboard/trips/completed">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Completed Trips</h3>
                  <p className="text-sm text-gray-500 mt-1">Review completed trips</p>
                </div>
                <ArrowRightIcon className="h-6 w-6 text-gray-400" />
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
}
