"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { School, Route, Users, GraduationCap, Building2 } from "lucide-react";

const modules = [
  {
    title: "Companies & Accounts",
    description: "Manage school companies, accounts, and driver assignments.",
    href: "/dashboard/companies",
    icon: Building2,
  },
  {
    title: "Schools",
    description: "Configure school profiles and institutional information.",
    href: "/dashboard/schools",
    icon: School,
  },
  {
    title: "Routes & Stops",
    description: "Create route topology, stop ordering, and stop-level rules.",
    href: "/dashboard/routes",
    icon: Route,
  },
  {
    title: "Students",
    description: "Enroll students, assign pickup stops, and maintain records.",
    href: "/dashboard/students",
    icon: GraduationCap,
  },
  {
    title: "Parents",
    description: "Link parent profiles to students and contact relationships.",
    href: "/dashboard/parents",
    icon: Users,
  },
];

export default function SchoolTransportHubPage() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            School Transport Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Unified workspace for enrollment, guardians, routes, and school operations.
          </p>
        </div>
        <Button className="primary-gradient text-white">Add New Student</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase font-bold text-slate-500">On-Time Arrivals</p>
            <p className="text-3xl font-black mt-2">94.2%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase font-bold text-slate-500">Active Buses</p>
            <p className="text-3xl font-black mt-2">18 / 20</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase font-bold text-slate-500">Partner Schools</p>
            <p className="text-3xl font-black mt-2">3</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.href} href={module.href}>
              <Card className="h-full hover:shadow-md transition-shadow border border-slate-100">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-indigo-50">
                      <Icon className="h-5 w-5 text-primary" />
                    </span>
                    {module.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{module.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

