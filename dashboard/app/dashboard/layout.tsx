"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import AppSidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { isAuthenticated, isCompanyUser, getUserRole, getCompanyId } from "@/lib/auth";
import QueryProvider from "@/lib/providers/QueryProvider";
import { CompanyProvider } from "@/lib/providers/CompanyProvider";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isMapPage = pathname === "/dashboard/map";
  const [isCompany, setIsCompany] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  // Check user role only on client side to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setIsCompany(isCompanyUser());
    setUserRole(getUserRole());
    setUserCompanyId(getCompanyId());
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!isAuthenticated()) {
      router.push("/");
      return;
    }

    // Redirect COMPANY users to map if they try to access other pages
    if (isCompany && !isMapPage) {
      router.push("/dashboard/map");
    }
  }, [router, pathname, isCompany, isMapPage, mounted]);

  // Hide sidebar for COMPANY users (only after mount to avoid hydration issues)
  const showSidebar = mounted ? !isCompany : true;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#f7f9fb]">
        {/* Sidebar - Hidden for COMPANY users */}
        {showSidebar && <AppSidebar />}

        {/* Main content */}
        <QueryProvider>
          <CompanyProvider userRole={userRole} userCompanyId={userCompanyId}>
            <SidebarInset className="flex flex-col">
              {!isMapPage && showSidebar && <Header />}
              <main
                className={`flex-1 overflow-x-hidden overflow-y-auto ${
                  !isMapPage && showSidebar ? "p-4 lg:p-6" : ""
                }`}
              >
                {children}
              </main>
            </SidebarInset>
          </CompanyProvider>
        </QueryProvider>
      </div>
    </SidebarProvider>
  );
}
