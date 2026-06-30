/**
 * dateUtils.ts — Date calculation utilities for chart filters and date ranges.
 *
 * These functions are pure helpers with no side effects. They operate on
 * JavaScript Date objects and ISO 8601 date strings (YYYY-MM-DD).
 */

/** Converts a Date to an ISO date string (YYYY-MM-DD), e.g. "2026-06-30". */
export function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Returns a {dateFrom, dateTo} range for a given preset label.
 * Supported presets: "today", "7d", "30d", "90d". Defaults to 7 days.
 */
export function getDateRange(preset: string): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const dateTo = toIsoDate(today);

  const daysBack: Record<string, number> = {
    today: 0,
    '7d':  7,
    '30d': 30,
    '90d': 90,
  };

  const days = daysBack[preset] ?? 7;
  const from = new Date(today);
  from.setDate(from.getDate() - days);

  return { dateFrom: toIsoDate(from), dateTo };
}

/**
 * Formats an ISO date string for chart axis labels.
 * Granularity controls the format: "hour" → "10:30 AM", "day" → "Jun 30",
 * "week" → "W26", anything else → "Jun 26".
 */
export function formatChartDate(iso: string, granularity: string): string {
  const d = new Date(iso);
  if (granularity === 'hour') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (granularity === 'day') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (granularity === 'week') {
    return `W${getWeekNumber(d)}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/** Returns the ISO week number (1–53) for a given date. */
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
