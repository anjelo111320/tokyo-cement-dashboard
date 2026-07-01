/**
 * formatters.ts — Display formatting utilities used across the dashboard.
 *
 * All functions are pure (no side effects) and return a formatted string or
 * number. Import only what you need — tree-shaking removes the rest.
 */

/** Formats a number with the given decimal places using en-US locale (e.g. 1,234.56). */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Formats a date-time ISO string as "Jun 30, 10:45 AM". */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Formats a date ISO string as "Jun 30, 2026". */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

