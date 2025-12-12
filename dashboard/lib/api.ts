import axios from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

console.log("🔗 API URL configured:", API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 seconds timeout
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("adminToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses and errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Ignore canceled requests (AbortError) - these are expected when requests are cancelled
    if (
      error.name === "AbortError" ||
      error.code === "ERR_CANCELED" ||
      error.message === "canceled"
    ) {
      return Promise.reject(error); // Reject silently without logging
    }

    // Handle network errors
    if (!error.response) {
      console.error("❌ Network error:", error.message);
      if (typeof window !== "undefined") {
        // Show user-friendly error message
        if (
          error.code === "ECONNREFUSED" ||
          error.message.includes("Network Error")
        ) {
          console.error("⚠️ Cannot connect to server. Please check:", API_URL);
        }
      }
    }

    // Handle auth errors
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("adminToken");
      window.location.href = "/";
    }

    // Handle other HTTP errors
    if (error.response) {
      console.error(
        `❌ API Error [${error.response.status}]:`,
        error.response.data
      );
    }

    return Promise.reject(error);
  }
);

// Notification API methods
export const getNotifications = async (filters?: {
  driverId?: string;
  documentType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) => {
  const params = new URLSearchParams();
  if (filters?.driverId) params.append("driverId", filters.driverId);
  if (filters?.documentType)
    params.append("documentType", filters.documentType);
  if (filters?.status) params.append("status", filters.status);
  if (filters?.startDate) params.append("startDate", filters.startDate);
  if (filters?.endDate) params.append("endDate", filters.endDate);
  if (filters?.page) params.append("page", filters.page.toString());
  if (filters?.limit) params.append("limit", filters.limit.toString());

  const response = await api.get(`/admin/notifications?${params.toString()}`);
  console.log("📬 Notifications API response:", {
    success: response.data?.success,
    notificationsCount: response.data?.notifications?.length || 0,
    total: response.data?.total,
    page: response.data?.page,
    fullResponse: response.data,
  });

  // Log first notification structure if available
  if (response.data?.notifications?.length > 0) {
    console.log("📬 First notification sample:", {
      id: response.data.notifications[0].id,
      driverId: response.data.notifications[0].driverId,
      driver: response.data.notifications[0].driver,
      type: response.data.notifications[0].type,
      documentType: response.data.notifications[0].documentType,
      status: response.data.notifications[0].status,
    });
  }

  return response.data;
};

export const getUnreadNotificationCount = async () => {
  const response = await api.get("/admin/notifications/unread-count");
  return response.data;
};

export const markNotificationAsRead = async (id: string) => {
  const response = await api.put(`/admin/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await api.put("/admin/notifications/mark-all-read");
  return response.data;
};

export default api;
