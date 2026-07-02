/**
 * common.types.ts — Shared API envelope types used by every service call.
 *
 * These mirror the Pydantic schemas in backend/schemas/common.py exactly.
 * All API responses are wrapped in ApiResponse<T> or PaginatedApiResponse<T>.
 */

export interface ApiMeta {
  timestamp: string;
  data_freshness?: string;
  source?: string;
}

/** Standard single-item API response envelope. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: ApiMeta;
}

/** Paginated list response envelope. */
export interface PaginatedApiResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
  meta: ApiMeta;
}

export interface Pagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

