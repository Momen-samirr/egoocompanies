"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import {
  NotificationFilters as NotificationFiltersType,
  NotificationStatus,
} from "@/types";
import NotificationItem from "@/components/notifications/NotificationItem";
import NotificationFilters from "@/components/notifications/NotificationFilters";
import Pagination from "@/components/common/Pagination";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckIcon } from "@heroicons/react/24/outline";

export default function NotificationsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<NotificationFiltersType>({
    page: 1,
    limit: 20,
  });

  const {
    notifications,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    isError,
    error,
    markAsRead,
    markAllAsRead,
    isMarkingAllAsRead,
  } = useNotifications({ filters });

  const handleFilterChange = (newFilters: NotificationFiltersType) => {
    setFilters({ ...newFilters, page: 1 }); // Reset to page 1 when filters change
  };

  const handleClearFilters = () => {
    setFilters({ page: 1, limit: 20 });
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleNotificationClick = async (
    notificationId: string,
    driverId: string
  ) => {
    // Mark as read if unread
    const notification = notifications.find((n) => n.id === notificationId);
    if (notification && notification.status === NotificationStatus.UNREAD) {
      markAsRead(notificationId);
    }
    // Navigate to driver page
    router.push(`/dashboard/drivers/${driverId}`);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Notification Center</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage and review driver document upload notifications
          </p>
        </div>
        {notifications.length > 0 && (
          <Button
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAllAsRead}
            icon={CheckIcon}
            variant="outline"
          >
            {isMarkingAllAsRead ? "Marking..." : "Mark All as Read"}
          </Button>
        )}
      </div>

      <NotificationFilters
        filters={filters}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      <Card className="border border-slate-100 rounded-xl">
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-red-600 mb-4">
                <p className="font-semibold">Error loading notifications</p>
                <p className="text-sm mt-2">
                  {error instanceof Error
                    ? error.message
                    : "Failed to fetch notifications. Please try again."}
                </p>
              </div>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="No notifications found"
                description={
                  filters.documentType ||
                  filters.status ||
                  filters.startDate ||
                  filters.endDate
                    ? "Try adjusting your filters to see more results."
                    : total > 0
                    ? `Found ${total} notification(s) but they may not match the current filters.`
                    : "You don't have any notifications yet. When drivers upload documents, they will appear here."
                }
              />
              {(process.env.NODE_ENV === "development" || total > 0) && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Debug Info:</strong>
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                    <li>Total notifications in database: {total}</li>
                    <li>Notifications returned: {notifications.length}</li>
                    <li>Current page: {page}</li>
                    <li>Page size: {limit}</li>
                    <li>Total pages: {totalPages}</li>
                    <li>Active filters: {JSON.stringify(filters, null, 2)}</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-3">
                    Check the browser console (F12) for detailed API response
                    logs.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() =>
                      handleNotificationClick(
                        notification.id,
                        notification.driverId
                      )
                    }
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={total}
                    pageSize={limit}
                    onPageChange={handlePageChange}
                    onPageSizeChange={(newSize) => {
                      setFilters({ ...filters, limit: newSize, page: 1 });
                    }}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
