"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { isAuthenticated, isCompanyUser } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isMapPage = pathname === "/dashboard/map";
  const isCompany = isCompanyUser();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/");
      return;
    }

    // Redirect COMPANY users to map if they try to access other pages
    if (isCompany && !isMapPage) {
      router.push("/dashboard/map");
    }
  }, [router, pathname, isCompany, isMapPage]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Hide sidebar for COMPANY users
  const showSidebar = !isCompany;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile sidebar overlay */}
      {showSidebar && sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden for COMPANY users */}
      {showSidebar && (
        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {!isMapPage && showSidebar && (
          <Header>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              aria-label="Toggle sidebar"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </Header>
        )}
        <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 ${!isMapPage && showSidebar ? "p-4 lg:p-6" : ""}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

