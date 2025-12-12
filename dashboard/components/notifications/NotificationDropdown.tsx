"use client";

import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationItem from "./NotificationItem";
import { AdminNotification } from "@/types";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import Link from "next/link";

interface NotificationDropdownProps {
  onClose: () => void;
}

export default function NotificationDropdown({
  onClose,
}: NotificationDropdownProps) {
  const router = useRouter();
  const { notifications, isLoading, markAsRead } = useNotifications({
    filters: { limit: 10, status: "UNREAD" }, // Show only unread, limit to 10
  });

  const handleNotificationClick = async (notification: AdminNotification) => {
    // Mark as read
    if (notification.status === "UNREAD") {
      markAsRead(notification.id);
    }

    // Navigate to driver page
    router.push(`/dashboard/drivers/${notification.driverId}`);
    onClose();
  };

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        {notifications.length > 0 && (
          <Link
            href="/dashboard/notifications"
            onClick={onClose}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View All
          </Link>
        )}
      </div>
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8">
            <EmptyState
              title="No new notifications"
              description="You're all caught up!"
            />
          </div>
        ) : (
          <div>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
