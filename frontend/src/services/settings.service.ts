import type { ApiResponse } from '@/types/common.types';
import { apiClient } from './api.client';

export interface CsvConfig {
  csv_base_path: string;
  refresh_interval_seconds: number;
  files: Record<string, { filename: string; enabled: boolean }>;
}

export const settingsService = {
  async getCsvConfig(): Promise<CsvConfig> {
    const res = await apiClient.get<ApiResponse<CsvConfig>>('/settings/csv-config');
    return res.data.data;
  },

  async updateCsvConfig(data: Partial<CsvConfig>): Promise<CsvConfig> {
    const res = await apiClient.post<ApiResponse<CsvConfig>>('/settings/csv-config', data);
    return res.data.data;
  },

  async triggerIngestion(): Promise<{ job_id: string; status: string; message: string }> {
    const res = await apiClient.post<ApiResponse<{ job_id: string; status: string; message: string }>>('/settings/ingestion/trigger');
    return res.data.data;
  },
};
