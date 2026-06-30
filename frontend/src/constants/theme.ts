export const CHART_COLORS = {
  primary: '#3d8bad',
  accent: '#e05540',
  success: '#22c55e',
  warning: '#f59e0b',
  info: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  series: ['#3d8bad', '#e05540', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'],
} as const;

export const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  idle: '#f59e0b',
  maintenance: '#e05540',
  offline: '#6b7280',
  delivered: '#22c55e',
  in_transit: '#3b82f6',
  scheduled: '#8b5cf6',
  failed: '#ef4444',
  ok: '#22c55e',
  low_stock: '#f59e0b',
  critical: '#ef4444',
  pending: '#8b5cf6',
  confirmed: '#3b82f6',
  in_production: '#3d8bad',
  cancelled: '#6b7280',
};
