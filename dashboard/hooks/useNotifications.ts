import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/lib/api";
import type {
  NotificationFilters,
  NotificationResponse,
  AdminNotification,
} from "@/types";
import { toast } from "react-hot-toast";

const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:8080";

export function useNotifications(filters: NotificationFilters = {}) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch notifications
  const {
    data: notificationsData,
    isLoading,
    error,
    refetch,
  } = useQuery<NotificationResponse>({
    queryKey: ["notifications", filters],
    queryFn: () => getNotifications(filters),
    refetchInterval: 30000, // Refetch every 30 seconds as fallback
  });

  // Fetch unread count
  const { data: unreadCount = 0, refetch: refetchUnreadCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      refetchUnreadCount();
      toast.success("Notification marked as read");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to mark notification as read");
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      refetchUnreadCount();
      toast.success("All notifications marked as read");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to mark all notifications as read");
    },
  });

  // WebSocket connection
  useEffect(() => {
    if (typeof window === "undefined") return;

    const connectWebSocket = () => {
      try {
        const token = localStorage.getItem("adminToken");
        if (!token) {
          console.warn("No admin token found, skipping WebSocket connection");
          return;
        }

        const wsUrl = `${SOCKET_SERVER_URL}?role=admin&token=${token}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("✅ WebSocket connected for notifications");
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "documentNotification") {
              // Invalidate queries to refetch notifications
              queryClient.invalidateQueries({ queryKey: ["notifications"] });
              refetchUnreadCount();

              // Show toast notification
              const notification = data.notification as AdminNotification;
              const action =
                notification.type === "DOCUMENT_UPDATE"
                  ? "updated"
                  : "uploaded";
              toast.success(
                `${notification.driver.name} ${action} ${notification.documentType}`,
                {
                  duration: 5000,
                }
              );
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log("WebSocket disconnected, reconnecting...");
          setIsConnected(false);
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("Error connecting to WebSocket:", error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [queryClient, refetchUnreadCount]);

  const handleMarkAsRead = useCallback(
    (notificationId: string) => {
      markAsReadMutation.mutate(notificationId);
    },
    [markAsReadMutation]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  return {
    notifications: notificationsData?.notifications || [],
    total: notificationsData?.total || 0,
    page: notificationsData?.page || 1,
    limit: notificationsData?.limit || 20,
    totalPages: notificationsData?.totalPages || 0,
    unreadCount,
    isLoading,
    error,
    refetch,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    isConnected,
  };
}
