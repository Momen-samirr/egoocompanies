"use client";

import { usePathname } from "next/navigation";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import { MagnifyingGlassIcon, BellIcon } from "@heroicons/react/24/outline";
import { ReactNode } from "react";

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: Array<{ label: string; href?: string }> = [];

  if (segments.length === 0 || (segments.length === 1 && segments[0] === "dashboard")) {
    return [];
  }

  // Skip "dashboard" segment
  const pathSegments = segments.slice(1);

  let currentPath = "/dashboard";
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === pathSegments.length - 1;
    
    // Format segment name
    const name = segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    breadcrumbs.push({
      label: name,
      href: isLast ? undefined : currentPath,
    });
  });

  return breadcrumbs;
}

interface HeaderProps {
  children?: ReactNode;
}

export default function Header({ children }: HeaderProps) {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
      <div className="px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {children}
            <div className="flex-1">
              {breadcrumbs.length > 0 ? (
                <Breadcrumbs items={breadcrumbs} />
              ) : (
                <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">
                  Dashboard Overview
                </h1>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 lg:space-x-4">
            <div className="relative hidden md:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search..."
                className="block w-48 lg:w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <BellIcon className="h-5 w-5 lg:h-6 lg:w-6" />
              <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500"></span>
            </button>
            <div className="flex items-center space-x-2 lg:space-x-3">
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                A
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-900">Admin</p>
                <p className="text-xs text-gray-500">admin@ridewave.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

