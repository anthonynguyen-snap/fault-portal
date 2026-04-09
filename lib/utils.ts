import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, startOfWeek, startOfMonth, isAfter, isBefore } from 'date-fns';
import { ClaimStatus } from '@/types';

// Merge Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

// Format a date string nicely
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

// Format a datetime string
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy, h:mm a');
  } catch {
    return dateStr;
  }
}

// Get the start of the current week (Monday)
export function getStartOfWeek(): Date {
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

// Get the start of the current month
export function getStartOfMonth(): Date {
  return startOfMonth(new Date());
}

// Check if a date string falls within the current week
export function isThisWeek(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    return isAfter(date, getStartOfWeek());
  } catch {
    return false;
  }
}

// Check if a date string falls within the current month
export function isThisMonth(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    return isAfter(date, getStartOfMonth());
  } catch {
    return false;
  }
}

// Check if a date is within a date range
export function isInDateRange(dateStr: string, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  try {
    const date = new Date(dateStr);
    if (from && isBefore(date, new Date(from))) return false;
    if (to && isAfter(date, new Date(to))) return false;
    return true;
  } catch {
    return true;
  }
}

// Status badge styling
export const STATUS_STYLES: Record<ClaimStatus, string> = {
  'Unsubmitted':    'bg-slate-100 text-slate-700',
  'Claim Raised':   'bg-blue-100 text-blue-700',
  'Acknowledged':   'bg-amber-100 text-amber-700',
  'Credit Received':'bg-emerald-100 text-emerald-700',
  'Rejected':       'bg-red-100 text-red-700',
};

export const STATUS_DOT: Record<ClaimStatus, string> = {
  'Unsubmitted':    'bg-slate-400',
  'Claim Raised':   'bg-blue-500',
  'Acknowledged':   'bg-amber-500',
  'Credit Received':'bg-emerald-500',
  'Rejected':       'bg-red-500',
};

export const CLAIM_STATUSES: ClaimStatus[] = [
  'Unsubmitted',
  'Claim Raised',
  'Acknowledged',
  'Credit Received',
  'Rejected',
];

// Generate a short unique ID for display
export function shortId(id: string): string {
  return id.split('-').pop()?.slice(-6).toUpperCase() || id;
}

// Group an array by a key
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) result[groupKey] = [];
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

// Get month name
export function getMonthName(date: Date): string {
  return format(date, 'MMMM yyyy');
}

// Truncate long strings
export function truncate(str: string, length: number): string {
  if (!str) return '';
  return str.length > length ? str.slice(0, length) + '…' : str;
}
