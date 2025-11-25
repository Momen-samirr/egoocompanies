import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
    if (error.name === "AbortError" || error.code === "ERR_CANCELED" || error.message === "canceled") {
      return Promise.reject(error); // Reject silently without logging
    }

    // Handle network errors
    if (!error.response) {
      console.error("❌ Network error:", error.message);
      if (typeof window !== "undefined") {
        // Show user-friendly error message
        if (error.code === "ECONNREFUSED" || error.message.includes("Network Error")) {
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
      console.error(`❌ API Error [${error.response.status}]:`, error.response.data);
    }

    return Promise.reject(error);
  }
);

export default api;

