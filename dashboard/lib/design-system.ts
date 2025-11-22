/**
 * Design System Configuration
 * Centralized design tokens for consistent UI across the dashboard
 */

export const colors = {
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5', // Primary action color
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a', // Success/Completed
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706', // Warning/Pending
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626', // Error/Cancelled
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb', // Info/In Progress
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
} as const;

export const typography = {
  h1: 'text-4xl font-bold',
  h2: 'text-2xl font-semibold',
  h3: 'text-xl font-semibold',
  body: 'text-base',
  small: 'text-sm',
  xs: 'text-xs',
} as const;

export const spacing = {
  page: 'space-y-6',
  section: 'gap-6',
  form: 'gap-4',
  card: {
    standard: 'p-6',
    large: 'p-8',
  },
  button: {
    standard: 'px-4 py-2',
    primary: 'px-6 py-3',
  },
} as const;

export const shadows = {
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-lg',
  hover: 'hover:shadow-md transition-shadow duration-200',
} as const;

export const statusColors = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm',
  'in progress': 'bg-blue-100 text-blue-800 border-blue-200',
  active: 'bg-lime-100 text-lime-700 border-lime-300 shadow-sm',
  accepted: 'bg-blue-100 text-blue-800 border-blue-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  scheduled: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  failed: 'bg-red-200 text-red-900 border-red-500',
  'emergency_terminated': 'bg-orange-200 text-orange-900 border-orange-500',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
} as const;

export type StatusType = keyof typeof statusColors;

