"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationItem from "./NotificationItem";
import NotificationFilters from "./NotificationFilters";
import type { NotificationFilters as NotificationFiltersType } from "@/types";
import { CheckIcon } from "@heroicons/react/24/outline";
import Button from "@/components/common/Button";
import Pagination from "@/components/common/Pagination";

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
    unreadCount,
    isLoading,
    markAllAsRead,
    isMarkingAllAsRead,
  } = useNotifications(filters);

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadCount > 0
              ? `${unreadCount} unread notification${
                  unreadCount !== 1 ? "s" : ""
                }`
              : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={() => markAllAsRead()}
            loading={isMarkingAllAsRead}
            icon={CheckIcon}
            iconPosition="left"
          >
            Mark all as read
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <NotificationFilters filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Notifications List */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {isLoading ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500">No notifications found</p>
                <p className="text-sm text-gray-400 mt-2">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      totalItems={total}
                      pageSize={limit}
                      onPageChange={handlePageChange}
                      showPageNumbers={true}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
