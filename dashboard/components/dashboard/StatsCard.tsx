"use client";

import Card, { CardBody } from "@/components/common/Card";
import type { ComponentType } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
}

export default function StatsCard({ title, value, icon: Icon, trend, subtitle }: StatsCardProps) {
  return (
    <Card hover className="transition-all duration-200 group">
      <CardBody>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1.5">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center mt-3">
                <span
                  className={`inline-flex items-center text-sm font-semibold ${
                    trend.isPositive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {trend.isPositive ? (
                    <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-gray-500 ml-2">vs last period</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="ml-4">
              <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 group-hover:from-indigo-200 group-hover:to-indigo-100 transition-all duration-200">
                <Icon className="h-7 w-7 text-indigo-600" />
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

