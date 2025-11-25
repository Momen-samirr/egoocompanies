"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UsersIcon,
  TruckIcon,
  MapIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  MapPinIcon,
  CalendarIcon,
  Squares2X2Icon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import { logout, isCompanyUser } from "@/lib/auth";

interface NavGroup {
  title?: string;
  items: NavItem[];
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigationGroups: NavGroup[] = [
  {
    title: "Core",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
      { name: "Live Map", href: "/dashboard/map", icon: MapPinIcon },
    ],
  },
  {
    title: "Management",
    items: [
      { name: "Users", href: "/dashboard/users", icon: UsersIcon },
      { name: "Drivers", href: "/dashboard/drivers", icon: TruckIcon },
      { name: "Rides", href: "/dashboard/rides", icon: MapIcon },
      { name: "Scheduled Trips", href: "/dashboard/trips", icon: CalendarIcon },
    ],
  },
  {
    title: "Companies",
    items: [{ name: "Companies", href: "/dashboard/companies", icon: BuildingOffice2Icon }],
  },
  {
    title: "Analytics",
    items: [
      { name: "Analytics", href: "/dashboard/analytics", icon: ChartBarIcon },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isCompany = isCompanyUser();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  // Filter navigation groups based on role
  const filteredGroups = isCompany
    ? navigationGroups.filter((group) => {
        // For COMPANY users, only show groups with Live Map
        return group.items.some((item) => item.href === "/dashboard/map");
      }).map((group) => ({
        ...group,
        items: group.items.filter((item) => item.href === "/dashboard/map"),
      }))
    : navigationGroups;

  return (
    <div className="flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800/50">
      {/* Logo/Branding Area */}
      <div className="flex items-center gap-3 h-18 px-6 border-b border-slate-800/50">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg">
          <Squares2X2Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">{isCompany ? "Company" : "Mo2 Admin"}</h1>
          <p className="text-xs text-slate-400">{isCompany ? "Live Map" : "Dashboard"}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto sidebar-scroll">
        {filteredGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.title && (
              <div className="px-4 py-2 mb-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {group.title}
                </h3>
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                      active
                        ? "bg-indigo-600/10 text-indigo-400 shadow-sm"
                        : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                    }`}
                  >
                    <item.icon
                      className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200 ${
                        active
                          ? "text-indigo-400"
                          : "text-slate-400 group-hover:text-slate-300"
                      }`}
                    />
                    <span className="flex-1">{item.name}</span>
                    {active && (
                      <div className="ml-2 h-1.5 w-1.5 rounded-full bg-indigo-400"></div>
                    )}
                  </Link>
                );
              })}
            </div>
            {groupIndex < navigationGroups.length - 1 && (
              <div className="mt-6 border-t border-slate-800/50"></div>
            )}
          </div>
        ))}
      </nav>

      {/* Logout Section */}
      <div className="p-4 border-t border-slate-800/50 bg-slate-800/30">
        <button
          onClick={logout}
          className="flex items-center w-full px-4 py-3 text-sm font-medium text-slate-300 rounded-xl hover:bg-red-600/10 hover:text-red-400 transition-all duration-200 group"
        >
          <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-slate-400 group-hover:text-red-400 transition-colors duration-200" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

