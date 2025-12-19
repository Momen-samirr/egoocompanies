"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import StatsCard from "@/components/dashboard/StatsCard";
import { DashboardStats, Ride } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Truck,
  MapPin,
  DollarSign,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Failed to load dashboard stats</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-primary via-primary to-primary/90 rounded-2xl shadow-lg p-8 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Welcome back, Admin!</h1>
          <p className="text-primary-foreground/80 text-base">
            Here's what's happening with your ride-sharing platform today.
          </p>
        </div>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-24 w-24 bg-primary-foreground/20 rounded-full blur-2xl"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          subtitle="Registered users"
        />
        <StatsCard
          title="Total Drivers"
          value={stats.totalDrivers}
          icon={Truck}
          subtitle={`${stats.activeDrivers} active`}
        />
        <StatsCard
          title="Active Rides"
          value={stats.activeRides}
          icon={MapPin}
          subtitle="In progress now"
        />
        <StatsCard
          title="Today's Revenue"
          value={`$${stats.revenue.today.toFixed(2)}`}
          icon={DollarSign}
          subtitle={`Total: $${stats.revenue.total.toFixed(2)}`}
        />
        <StatsCard
          title="Active Drivers"
          value={stats.activeDrivers}
          icon={CheckCircle}
          subtitle="Online now"
        />
        <StatsCard
          title="Pending Verifications"
          value={stats.pendingVerifications}
          icon={Clock}
          subtitle="Awaiting review"
        />
        <StatsCard
          title="Total Rides"
          value={stats.totalRides}
          icon={BarChart3}
          subtitle="All time"
        />
        <StatsCard
          title="Total Revenue"
          value={`$${stats.revenue.total.toFixed(2)}`}
          icon={DollarSign}
          subtitle="All time earnings"
        />
      </div>

      {/* Recent Rides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Rides</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/rides")}
            >
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentRides && stats.recentRides.length > 0 ? (
                  stats.recentRides.map((ride) => (
                    <TableRow key={ride.id}>
                      <TableCell className="font-medium">
                        {ride.user?.name || ride.user?.phone_number || "N/A"}
                      </TableCell>
                      <TableCell>
                        {ride.driver?.name || ride.driver?.phone_number || "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{ride.currentLocationName}</div>
                        <div className="text-xs text-muted-foreground">→ {ride.destinationLocationName}</div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${ride.charge.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ride.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(ride.cratedAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/rides/${ride.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No recent rides
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
