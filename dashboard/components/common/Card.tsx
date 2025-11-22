"use client";

import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  shadow?: "sm" | "md" | "lg";
}

export default function Card({ children, className = "", hover = false, shadow = "sm" }: CardProps) {
  const shadowClass = shadow === "sm" ? "shadow-sm" : shadow === "md" ? "shadow-md" : "shadow-lg";
  const hoverClass = hover ? "hover:shadow-md transition-all duration-200 hover:-translate-y-0.5" : "";

  return (
    <div className={`bg-white rounded-xl border border-gray-200/60 ${shadowClass} ${hoverClass} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div className={`px-6 py-5 border-b border-gray-200/60 bg-gray-50/50 rounded-t-xl ${className}`}>
      {children}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
  padding?: "standard" | "large" | "none";
}

export function CardBody({ children, className = "", padding = "standard" }: CardBodyProps) {
  const paddingClass = padding === "standard" ? "p-6" : padding === "large" ? "p-8" : "";
  return (
    <div className={`${paddingClass} ${className}`}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div className={`px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 rounded-b-xl ${className}`}>
      {children}
    </div>
  );
}

