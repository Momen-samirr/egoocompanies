"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import StatsCard from "@/components/dashboard/StatsCard";
import { DashboardStats } from "@/types";

export default function DashboardPage() {
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
        <div className="text-gray-600">Loading...</div>
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
      <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon="👥"
        />
        <StatsCard
          title="Total Drivers"
          value={stats.totalDrivers}
          icon="🚗"
        />
        <StatsCard
          title="Active Rides"
          value={stats.activeRides}
          icon="📍"
        />
        <StatsCard
          title="Today's Revenue"
          value={`$${stats.revenue.today.toFixed(2)}`}
          icon="💰"
        />
        <StatsCard
          title="Active Drivers"
          value={stats.activeDrivers}
          icon="✅"
        />
        <StatsCard
          title="Pending Verifications"
          value={stats.pendingVerifications}
          icon="⏳"
        />
        <StatsCard
          title="Total Rides"
          value={stats.totalRides}
          icon="🚕"
        />
        <StatsCard
          title="Total Revenue"
          value={`$${stats.revenue.total.toFixed(2)}`}
          icon="💵"
        />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Rides</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Charge
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.recentRides && stats.recentRides.length > 0 ? (
                stats.recentRides.map((ride) => (
                  <tr key={ride.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ride.user?.name || ride.user?.phone_number || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ride.driver?.name || ride.driver?.phone_number || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div>{ride.currentLocationName}</div>
                      <div className="text-xs">→ {ride.destinationLocationName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${ride.charge.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          ride.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : ride.status === "In Progress"
                            ? "bg-blue-100 text-blue-800"
                            : ride.status === "Cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {ride.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ride.cratedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No recent rides
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

