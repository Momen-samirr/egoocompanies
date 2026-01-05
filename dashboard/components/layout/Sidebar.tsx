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
  Route,
  GraduationCap,
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
    title: "Core",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: Home },
      { name: "Live Map", href: "/dashboard/map", icon: MapPin },
    ],
  },
  {
    title: "Management",
    items: [
      { name: "Users", href: "/dashboard/users", icon: Users },
      { name: "Drivers", href: "/dashboard/drivers", icon: Truck },
      { name: "Rides", href: "/dashboard/rides", icon: Map },
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
      {
        name: "Notifications",
        href: "/dashboard/notifications",
        icon: Bell,
      },
    ],
  },
  {
    title: "Companies",
    items: [
      {
        name: "Companies",
        href: "/dashboard/companies",
        icon: Building2,
      },
    ],
  },
  {
    title: "School Transportation",
    items: [
      {
        name: "Schools",
        href: "/dashboard/schools",
        icon: School,
      },
      {
        name: "Routes & Stops",
        href: "/dashboard/routes",
        icon: Route,
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
    title: "Analytics",
    items: [
      { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
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
    <Sidebar>
      <SidebarHeader className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary shadow-lg">
          <LayoutGrid className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground">
            {mounted && isCompany ? "Company" : "Mo2 Admin"}
          </h1>
          <p className="text-xs text-sidebar-foreground/70">
            {mounted && isCompany ? "Live Map" : "Dashboard"}
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
          onClick={logout}
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="mr-2 h-5 w-5" />
          <span>Logout</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
