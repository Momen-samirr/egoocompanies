"use client";

import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationItem from "./NotificationItem";
import { AdminNotification, NotificationStatus } from "@/types";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function NotificationDropdown() {
  const router = useRouter();
  const { notifications, isLoading, markAsRead } = useNotifications({
    filters: { limit: 10, status: NotificationStatus.UNREAD }, // Show only unread, limit to 10
  });

  const handleNotificationClick = async (notification: AdminNotification) => {
    // Mark as read
    if (notification.status === NotificationStatus.UNREAD) {
      markAsRead(notification.id);
    }

    // Navigate to driver page
    router.push(`/dashboard/drivers/${notification.driverId}`);
  };

  return (
    <div className="flex flex-col max-h-96">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        {notifications.length > 0 && (
          <Link
            href="/dashboard/notifications"
            className="text-xs text-primary hover:text-primary/80 font-medium"
          >
            View All
          </Link>
        )}
      </div>
      <ScrollArea className="flex-1">
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
            {notifications.map((notification, index) => (
              <div key={notification.id}>
                <NotificationItem
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
                {index < notifications.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
