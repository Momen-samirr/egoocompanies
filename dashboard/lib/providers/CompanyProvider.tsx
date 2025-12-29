"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface CompanyContextType {
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
}

const CompanyContext = createContext<CompanyContextType | null>(null);

interface CompanyProviderProps {
  children: ReactNode;
  userRole: string | null;
  userCompanyId: string | null;
}

export function CompanyProvider({
  children,
  userRole,
  userCompanyId,
}: CompanyProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(
    null
  );
  const [mounted, setMounted] = useState(false);

  // Initialize company selection on mount
  useEffect(() => {
    setMounted(true);

    // For COMPANY role users, they're locked to their company
    if (userRole === "COMPANY" && userCompanyId) {
      setSelectedCompanyIdState(userCompanyId);
      return;
    }

    // For ADMIN/SUPER_ADMIN, check URL param first, then default to null (All Companies)
    const companyParam = searchParams.get("company");
    if (companyParam) {
      setSelectedCompanyIdState(companyParam);
    } else {
      setSelectedCompanyIdState(null);
    }
  }, [userRole, userCompanyId, searchParams]);

  const setSelectedCompanyId = (id: string | null) => {
    // Don't allow COMPANY role users to change their company
    if (userRole === "COMPANY") {
      return;
    }

    setSelectedCompanyIdState(id);

    // Update URL query params without navigation
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("company", id);
    } else {
      params.delete("company");
    }

    // Use router.replace to update URL without adding to history
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(newUrl, { scroll: false });
  };

  // Always provide context, even before mount, to avoid hook errors
  // The selectedCompanyId will be null initially and updated after mount
  return (
    <CompanyContext.Provider
      value={{
        selectedCompanyId: mounted ? selectedCompanyId : null,
        setSelectedCompanyId,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext(): CompanyContextType {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error(
      "useCompanyContext must be used within a CompanyProvider"
    );
  }
  return context;
}

// Safe hook that returns null if not in provider (for optional usage)
export function useCompanyContextSafe(): CompanyContextType | null {
  return useContext(CompanyContext);
}

