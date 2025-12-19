"use client";

import { usePathname } from "next/navigation";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import { Search } from "lucide-react";
import { ReactNode } from "react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: Array<{ label: string; href?: string }> = [];

  if (
    segments.length === 0 ||
    (segments.length === 1 && segments[0] === "dashboard")
  ) {
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
    <header className="sticky top-0 z-10 border-b bg-card shadow-sm">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-4 flex-1">
          <SidebarTrigger />
          {children}
          <div className="flex-1">
            {breadcrumbs.length > 0 ? (
              <Breadcrumbs items={breadcrumbs} />
            ) : (
              <h1 className="text-xl lg:text-2xl font-semibold text-foreground">
                Dashboard Overview
              </h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              className="w-48 lg:w-64 pl-10"
            />
          </div>
          <ThemeToggle />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 lg:gap-3 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    A
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-foreground">Admin</p>
                  <p className="text-xs text-muted-foreground">
                    admin@ridewave.com
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
