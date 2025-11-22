"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import StatsCard from "@/components/dashboard/StatsCard";
import { DashboardStats, Ride } from "@/types";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import Card, { CardHeader, CardBody } from "@/components/common/Card";
import StatusBadge from "@/components/common/StatusBadge";
import Button from "@/components/common/Button";
import {
  UsersIcon,
  TruckIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get("/admin/dashboard/stats");
      setStats(response.data.stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Failed to load dashboard stats</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-700 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Welcome back, Admin!</h1>
          <p className="text-indigo-100 text-base">
            Here's what's happening with your ride-sharing platform today.
          </p>
        </div>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-24 w-24 bg-indigo-400/20 rounded-full blur-2xl"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon={UsersIcon}
          subtitle="Registered users"
        />
        <StatsCard
          title="Total Drivers"
          value={stats.totalDrivers}
          icon={TruckIcon}
          subtitle={`${stats.activeDrivers} active`}
        />
        <StatsCard
          title="Active Rides"
          value={stats.activeRides}
          icon={MapPinIcon}
          subtitle="In progress now"
        />
        <StatsCard
          title="Today's Revenue"
          value={`$${stats.revenue.today.toFixed(2)}`}
          icon={CurrencyDollarIcon}
          subtitle={`Total: $${stats.revenue.total.toFixed(2)}`}
        />
        <StatsCard
          title="Active Drivers"
          value={stats.activeDrivers}
          icon={CheckCircleIcon}
          subtitle="Online now"
        />
        <StatsCard
          title="Pending Verifications"
          value={stats.pendingVerifications}
          icon={ClockIcon}
          subtitle="Awaiting review"
        />
        <StatsCard
          title="Total Rides"
          value={stats.totalRides}
          icon={ChartBarIcon}
          subtitle="All time"
        />
        <StatsCard
          title="Total Revenue"
          value={`$${stats.revenue.total.toFixed(2)}`}
          icon={CurrencyDollarIcon}
          subtitle="All time earnings"
        />
      </div>

      {/* Recent Rides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Recent Rides</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/rides")}
              icon={ArrowRightIcon}
              iconPosition="right"
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardBody padding="none">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200/60">
              <thead className="bg-gradient-to-b from-gray-50 to-gray-100/50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Charge
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200/60">
                {stats.recentRides && stats.recentRides.length > 0 ? (
                  stats.recentRides.map((ride) => (
                    <tr key={ride.id} className="hover:bg-indigo-50/30 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {ride.user?.name || ride.user?.phone_number || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {ride.driver?.name || ride.driver?.phone_number || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="font-medium">{ride.currentLocationName}</div>
                        <div className="text-xs text-gray-400">→ {ride.destinationLocationName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${ride.charge.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={ride.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDistanceToNow(new Date(ride.cratedAt), { addSuffix: true })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/rides/${ride.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                      No recent rides
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

