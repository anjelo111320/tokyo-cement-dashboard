/**
 * common.types.ts — Shared API envelope types used by every service call.
 *
 * These mirror the Pydantic schemas in backend/schemas/common.py exactly.
 * All API responses are wrapped in ApiResponse<T>.
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


