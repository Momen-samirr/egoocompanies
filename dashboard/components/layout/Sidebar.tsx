"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Truck,
  Map,
  BarChart3,
  LogOut,
  MapPin,
  Calendar,
  LayoutGrid,
  Building2,
  Bell,
  ClipboardCheck,
  Film,
  School,
  GraduationCap,
  ShieldAlert,
} from "lucide-react";
import { logout, isCompanyUser } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    title: "Dashboard",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: Home },
    ],
  },
  {
    title: "Operations",
    items: [
      { name: "Live Map", href: "/dashboard/map", icon: MapPin },
      {
        name: "Notifications",
        href: "/dashboard/notifications",
        icon: Bell,
      },
    ],
  },
  {
    title: "Trips Hub",
    items: [
      { name: "Scheduled Trips", href: "/dashboard/trips", icon: Calendar },
      {
        name: "Trip Replay",
        href: "/dashboard/trips/replay",
        icon: Film,
      },
      {
        name: "Operations",
        href: "/dashboard/trips/operations",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    title: "Management",
    items: [
      { name: "Drivers", href: "/dashboard/drivers", icon: Truck },
      { name: "Users", href: "/dashboard/users", icon: Users },
      { name: "Rides", href: "/dashboard/rides", icon: Map },
      {
        name: "Companies",
        href: "/dashboard/companies",
        icon: Building2,
      },
    ],
  },
  {
    title: "School Transport",
    items: [
      {
        name: "School Hub",
        href: "/dashboard/school-transport",
        icon: School,
      },
      {
        name: "Schools",
        href: "/dashboard/schools",
        icon: Building2,
      },
      {
        name: "Routes & Stops",
        href: "/dashboard/routes",
        icon: School,
      },
      {
        name: "Students",
        href: "/dashboard/students",
        icon: GraduationCap,
      },
      {
        name: "Parents",
        href: "/dashboard/parents",
        icon: Users,
      },
    ],
  },
  {
    title: "Finance & Analytics",
    items: [
      {
        name: "Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
      },
      {
        name: "Trip Exceptions",
        href: "/dashboard/trips/emergency",
        icon: ShieldAlert,
      },
    ],
  },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const [isCompany, setIsCompany] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Check user role only on client side to avoid hydration mismatch
  useEffect(() => {
    // Defer state updates to avoid synchronous setState in effect
    const timer = setTimeout(() => {
      setMounted(true);
      setIsCompany(isCompanyUser());
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  // Filter navigation groups based on role (only after mount)
  const filteredGroups =
    mounted && isCompany
      ? navigationGroups
          .filter((group) => {
            // For COMPANY users, only show groups with Live Map
            return group.items.some((item) => item.href === "/dashboard/map");
          })
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => item.href === "/dashboard/map"),
          }))
      : navigationGroups;

  return (
    <Sidebar className="bg-slate-50 border-r-0">
      <SidebarHeader className="flex items-center gap-3 px-5 py-5">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-linear-to-br from-primary to-indigo-400 shadow-lg">
          <LayoutGrid className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            {mounted && isCompany ? "Company Console" : "Kinetic Precision"}
          </h1>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            {mounted && isCompany ? "Live Map Access" : "Logistics Control"}
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="sidebar-scroll">
        {filteredGroups.map((group, groupIndex) => (
          <SidebarGroup key={groupIndex}>
            {group.title && (
              <SidebarGroupLabel className="px-2">
                {group.title}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={cn(
                          active &&
                            "bg-sidebar-accent text-sidebar-accent-foreground"
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-5 w-5" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
            {groupIndex < filteredGroups.length - 1 && (
              <SidebarSeparator className="my-2" />
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Button
          variant="default"
          className="w-full mb-3 justify-center bg-linear-to-br from-primary to-indigo-400 text-white hover:opacity-90"
        >
          <LayoutGrid className="h-4 w-4 mr-2" />
          New Dispatch
        </Button>
        <Button
          onClick={logout}
          variant="ghost"
          className="w-full justify-start text-slate-700 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="mr-2 h-5 w-5" />
          <span>Logout</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
