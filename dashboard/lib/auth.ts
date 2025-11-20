import api from "./api";

export const login = async (email: string, password: string) => {
  const response = await api.post("/admin/login", { email, password });
  if (response.data.success) {
    if (typeof window !== "undefined") {
      localStorage.setItem("adminToken", response.data.token);
    }
    return response.data;
  }
  throw new Error(response.data.message);
};

export const logout = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("adminToken");
    window.location.href = "/";
  }
};

export const isAuthenticated = () => {
  if (typeof window !== "undefined") {
    return !!localStorage.getItem("adminToken");
  }
  return false;
};

export const getToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("adminToken");
  }
  return null;
};

