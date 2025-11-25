import api from "./api";

export const login = async (email: string, password: string) => {
  const response = await api.post("/admin/login", { email, password });
  if (response.data.success) {
    if (typeof window !== "undefined") {
      localStorage.setItem("adminToken", response.data.token);
      // Store admin data including role and companyId
      if (response.data.admin) {
        localStorage.setItem("adminData", JSON.stringify(response.data.admin));
      }
    }
    return response.data;
  }
  throw new Error(response.data.message);
};

export const logout = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminData");
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

export const getUserRole = (): string | null => {
  if (typeof window !== "undefined") {
    const adminData = localStorage.getItem("adminData");
    if (adminData) {
      try {
        const data = JSON.parse(adminData);
        return data.role || null;
      } catch (e) {
        return null;
      }
    }
    // Fallback: decode from token
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.role || null;
      } catch (e) {
        return null;
      }
    }
  }
  return null;
};

export const getCompanyId = (): string | null => {
  if (typeof window !== "undefined") {
    const adminData = localStorage.getItem("adminData");
    if (adminData) {
      try {
        const data = JSON.parse(adminData);
        return data.companyId || null;
      } catch (e) {
        return null;
      }
    }
    // Fallback: decode from token
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.companyId || null;
      } catch (e) {
        return null;
      }
    }
  }
  return null;
};

export const getUserData = () => {
  if (typeof window !== "undefined") {
    const adminData = localStorage.getItem("adminData");
    if (adminData) {
      try {
        return JSON.parse(adminData);
      } catch (e) {
        return null;
      }
    }
    // Fallback: decode from token
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return {
          id: payload.id,
          role: payload.role,
          companyId: payload.companyId,
        };
      } catch (e) {
        return null;
      }
    }
  }
  return null;
};

export const isCompanyUser = (): boolean => {
  return getUserRole() === "COMPANY";
};

export const isAdminUser = (): boolean => {
  const role = getUserRole();
  return role !== null && role !== "COMPANY";
};

