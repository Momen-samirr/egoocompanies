"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import StatsCard from "@/components/dashboard/StatsCard";
import { DashboardStats } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  DollarSign,
  CheckCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
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
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Fleet Overview</h1>
          <p className="text-slate-600 mt-1">
            Real-time performance and operational health for today.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Export</Button>
          <Button className="primary-gradient text-white" onClick={() => router.push("/dashboard/trips/create")}>
            Create Trip
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Revenue" value={`$${stats.revenue.total.toFixed(2)}`} icon={DollarSign} subtitle="All operations" />
        <StatsCard title="Active Trips" value={stats.activeRides} icon={MapPin} subtitle="Currently in transit" />
        <StatsCard title="Online Drivers" value={stats.activeDrivers} icon={CheckCircle} subtitle={`${stats.totalDrivers} total drivers`} />
        <StatsCard title="System Alerts" value={stats.pendingVerifications} icon={Clock} subtitle="Requires review" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Revenue vs Operations</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" className="primary-gradient text-white">Daily</Button>
                <Button size="sm" variant="outline">Weekly</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-52 flex items-end gap-1">
              {[40, 55, 45, 70, 85, 65, 95, 60, 40, 30, 50, 65, 80].map((v, i) => (
                <div key={i} className={`flex-1 rounded-t-sm ${i === 6 ? "bg-primary/30" : "bg-primary/10"}`} style={{ height: `${v}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/dashboard/trips/create")}>New Trip</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/dashboard/drivers")}>Add Driver</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/dashboard/map")}>Live Map</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Rides</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/rides")}>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Pickup / Dropoff</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentRides && stats.recentRides.length > 0 ? (
                  stats.recentRides.map((ride) => (
                    <TableRow key={ride.id}>
                      <TableCell>
                        <Badge variant="secondary">{ride.status}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {ride.driver?.name || ride.driver?.phone_number || "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{ride.currentLocationName}</div>
                        <div className="text-xs text-muted-foreground">→ {ride.destinationLocationName}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">${ride.charge.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/rides/${ride.id}`)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
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
