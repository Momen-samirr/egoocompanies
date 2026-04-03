"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Driver, Pagination } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import { Eye, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function DriversPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);

      const response = await api.get(`/admin/drivers?${params}`);
      setDrivers(response.data.drivers);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (driverId: string, newStatus: string) => {
    try {
      await api.put(`/admin/drivers/${driverId}/status`, { status: newStatus });
      fetchDrivers();
    } catch (error) {
      console.error("Error updating driver status:", error);
      alert("Failed to update driver status");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Drivers Management</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage, track, and monitor your active fleet operators in real-time.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Export List</Button>
          <Button className="primary-gradient text-white">Onboard New Driver</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5"><p className="text-xs uppercase font-bold text-slate-500">Total Fleet</p><p className="text-3xl font-black">{pagination?.total || drivers.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs uppercase font-bold text-slate-500">Online Now</p><p className="text-3xl font-black">{drivers.filter((d) => d.status === "active").length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs uppercase font-bold text-slate-500">Avg Rating</p><p className="text-3xl font-black">4.8</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs uppercase font-bold text-slate-500">Pending Renewal</p><p className="text-3xl font-black text-amber-600">{drivers.filter((d) => d.status !== "active").length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, phone, or registration..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-100 border-none"
              />
            </div>
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => {
                setStatusFilter(value === "all" ? "" : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading drivers..." />
            </div>
          ) : drivers.length === 0 ? (
            <EmptyState
              title="No drivers found"
              description="Try adjusting your search or filters"
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70">
                      <TableHead>Driver Detail</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Vehicle Type</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>Total Rides</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map((driver) => (
                      <TableRow key={driver.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="font-semibold">
                          <div className="flex flex-col">
                            <span className="font-bold">{driver.name}</span>
                            <span className="text-xs text-muted-foreground">Earnings: ${driver.totalEarning.toFixed(2)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {driver.phone_number}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{driver.vehicle_type}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          4.8 ★
                        </TableCell>
                        <TableCell>{driver.totalRides}</TableCell>
                        <TableCell>
                          <Select
                            value={driver.status}
                            onValueChange={(value) =>
                              handleStatusChange(driver.id, value)
                            }
                          >
                            <SelectTrigger className="w-[120px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(`/dashboard/drivers/${driver.id}`)
                            }
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    Showing {(page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(page * pagination.limit, pagination.total)} of{" "}
                    {pagination.total} results
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= pagination.pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
