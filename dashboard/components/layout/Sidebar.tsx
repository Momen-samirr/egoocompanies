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
} from "@heroicons/react/24/outline";
import { logout } from "@/lib/auth";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { name: "Live Map", href: "/dashboard/map", icon: MapPinIcon },
  { name: "Users", href: "/dashboard/users", icon: UsersIcon },
  { name: "Drivers", href: "/dashboard/drivers", icon: TruckIcon },
  { name: "Rides", href: "/dashboard/rides", icon: MapIcon },
  { name: "Scheduled Trips", href: "/dashboard/trips", icon: CalendarIcon },
  { name: "Analytics", href: "/dashboard/analytics", icon: ChartBarIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col w-64 bg-gray-900 text-white">
      <div className="flex items-center justify-center h-16 bg-gray-800">
        <h1 className="text-xl font-bold">Mo2 Admin</h1>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-800 hover:text-white"
        >
          <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}

