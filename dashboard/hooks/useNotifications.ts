import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/api";
import {
  AdminNotification,
  NotificationFilters,
  NotificationResponse,
} from "@/types";

interface UseNotificationsOptions {
  filters?: NotificationFilters;
  enabled?: boolean;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response
      ?.data?.message === "string"
  ) {
    return (
      (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message || fallback
    );
  }
  return fallback;
};

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { filters, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch notifications
  const notificationsQuery = useQuery({
    queryKey: ["notifications", filters],
    queryFn: async () => {
      try {
        const response = await getNotifications(filters);
        console.log("🔔 useNotifications - Fetched notifications:", {
          notifications: response?.notifications?.length || 0,
          total: response?.total,
          success: response?.success,
        });
        // Handle both response formats: { success: true, ... } or direct NotificationResponse
        let result: NotificationResponse;
        if (response?.success !== undefined) {
          // Response format: { success: true, notifications: [...], total: ..., page: ..., limit: ..., totalPages: ... }
          result = {
            notifications: response.notifications || [],
            total: response.total || 0,
            page: response.page || 1,
            limit: response.limit || 20,
            totalPages: response.totalPages || 0,
          } as NotificationResponse;
        } else {
          // Direct NotificationResponse format
          result = response as NotificationResponse;
        }

        // Log the actual notifications received
        console.log("🔔 useNotifications - Parsed result:", {
          notificationsCount: result.notifications?.length || 0,
          total: result.total,
          firstNotification: result.notifications?.[0]
            ? {
                id: result.notifications[0].id,
                driverId: result.notifications[0].driverId,
                hasDriver: !!result.notifications[0].driver,
                driverName: result.notifications[0].driver?.name,
                type: result.notifications[0].type,
                documentType: result.notifications[0].documentType,
                status: result.notifications[0].status,
              }
            : null,
        });

        return result;
      } catch (error) {
        console.error(
          "❌ useNotifications - Error fetching notifications:",
          error
        );
        throw error;
      }
    },
    enabled,
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Fetch unread count
  const unreadCountQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await getUnreadNotificationCount();
      return response.count as number;
    },
    enabled,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await markNotificationAsRead(id);
    },
    onSuccess: () => {
      // Invalidate both queries to refetch
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
    onError: (error) => {
      console.error("Error marking notification as read:", error);
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return await markAllNotificationsAsRead();
    },
    onSuccess: () => {
      // Invalidate both queries to refetch
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
    onError: (error) => {
      console.error("Error marking all notifications as read:", error);
    },
  });

  const notifications = notificationsQuery.data?.notifications || [];
  const total = notificationsQuery.data?.total || 0;

  // Debug logging
  if (notificationsQuery.data && notifications.length === 0 && total > 0) {
    console.warn("⚠️ useNotifications - Data mismatch:", {
      totalFromAPI: total,
      notificationsArrayLength: notifications.length,
      fullData: notificationsQuery.data,
    });
  }

  return {
    notifications,
    total,
    page: notificationsQuery.data?.page || 1,
    limit: notificationsQuery.data?.limit || 20,
    totalPages: notificationsQuery.data?.totalPages || 0,
    isLoading: notificationsQuery.isLoading,
    isError: notificationsQuery.isError,
    error: notificationsQuery.error,
    refetch: notificationsQuery.refetch,
    unreadCount: unreadCountQuery.data || 0,
    isUnreadCountLoading: unreadCountQuery.isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAsReadAsync: markAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
    markAllAsRead: markAllAsReadMutation.mutate,
    markAllAsReadAsync: markAllAsReadMutation.mutateAsync,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
  };
}
