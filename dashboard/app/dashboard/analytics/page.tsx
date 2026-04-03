"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

interface AnalyticsData {
  revenueByVehicleType?: Record<string, number | string>;
  statusDistribution?: Array<{ name: string; count: number }>;
  totalRevenue?: number;
  totalRides?: number;
  activeDrivers?: number;
  avgFare?: number;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/analytics?period=${period}`);
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading...</div>;
  }

  if (!analytics) {
    return <div className="text-center py-8 text-red-600">Failed to load analytics</div>;
  }

  // Process data for charts
  const revenueByType = Object.entries(analytics.revenueByVehicleType || {}).map(
    ([name, value]) => ({
      name,
      value: Number(value),
    })
  );

  const statusData = analytics.statusDistribution || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Analytics Overview</h1>
          <p className="text-sm text-slate-600 mt-1">Real-time performance metrics and historical data analysis.</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white text-sm font-medium"
        >
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
          <option value="year">Last Year</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-slate-600">Revenue</p>
          <p className="text-2xl font-black mt-1">${analytics.totalRevenue?.toFixed?.(2) ?? "0.00"}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-slate-600">Total Trips</p>
          <p className="text-2xl font-black mt-1">{analytics.totalRides ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-slate-600">Active Drivers</p>
          <p className="text-2xl font-black mt-1">{analytics.activeDrivers ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-slate-600">Avg Fare</p>
          <p className="text-2xl font-black mt-1">${analytics.avgFare?.toFixed?.(2) ?? "0.00"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Revenue by Vehicle Type
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Ride Status Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: { name?: string; percent?: number }) => {
                  const { name, percent } = props;
                  return `${name || "Unknown"} ${percent ? (percent * 100).toFixed(0) : 0}%`;
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {statusData.map((_, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

