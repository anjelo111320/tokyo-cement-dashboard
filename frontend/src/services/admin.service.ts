import { apiClient } from './api.client';

export interface AdminPlant {
  plant_id: string;
  name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  plant_type: string;
  is_active: boolean;
}

export interface AdminMaterial {
  material_id: string;
  description: string;
  brand_group: string | null;
  is_bag: boolean;
  is_bulk: boolean;
  is_active: boolean;
}

export interface AppSetting {
  key: string;
  value: string;
  value_type: string;
  description: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface IngestionLog {
  id: string;
  source: string;
  file_name: string | null;
  status: string;
  rows_loaded: number | null;
  error_msg: string | null;
  created_at: string;
}

export interface SharePointConfig {
  tenant_id: string | null;
  client_id: string | null;
  client_secret: string | null;
  site_url: string | null;
  drive_id: string | null;
  file_path: string | null;
  is_active: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrap = <T>(res: any): T => res.data.data;

export const adminService = {
  // Plants
  getPlants:    () => apiClient.get<{ data: { data: AdminPlant[] } }>('/admin/plants').then(wrap<AdminPlant[]>),
  createPlant:  (body: AdminPlant) => apiClient.post('/admin/plants', body),
  updatePlant:  (id: string, body: Partial<AdminPlant>) => apiClient.put(`/admin/plants/${id}`, body),
  deletePlant:  (id: string) => apiClient.delete(`/admin/plants/${id}`),

  // Materials
  getMaterials:    () => apiClient.get<{ data: { data: AdminMaterial[] } }>('/admin/materials').then(wrap<AdminMaterial[]>),
  createMaterial:  (body: AdminMaterial) => apiClient.post('/admin/materials', body),
  updateMaterial:  (id: string, body: Partial<AdminMaterial>) => apiClient.put(`/admin/materials/${id}`, body),
  deleteMaterial:  (id: string) => apiClient.delete(`/admin/materials/${id}`),
  syncMaterials:   () => apiClient.post('/admin/materials/sync'),

  // Settings
  getSettings: () => apiClient.get<{ data: { data: AppSetting[] } }>('/admin/settings').then(wrap<AppSetting[]>),
  updateSetting: (key: string, value: string) => apiClient.put(`/admin/settings/${key}`, { value }),

  // Thresholds
  getThresholds: () => apiClient.get<{ data: { data: { material_id: string; threshold_mt: number }[] } }>('/admin/thresholds').then(wrap<{ material_id: string; threshold_mt: number }[]>),
  upsertThreshold: (material_id: string, threshold_mt: number) => apiClient.put(`/admin/thresholds/${material_id}`, { threshold_mt }),
  deleteThreshold: (material_id: string) => apiClient.delete(`/admin/thresholds/${material_id}`),

  // Users
  getUsers: () => apiClient.get<{ data: { data: AdminUser[] } }>('/admin/users').then(wrap<AdminUser[]>),
  createUser: (body: { email: string; password: string; role: string }) => apiClient.post('/admin/users', body),
  updateUser: (id: string, body: { role?: string; is_active?: boolean }) => apiClient.put(`/admin/users/${id}`, body),

  // SharePoint
  getSharePoint: () => apiClient.get<{ data: { data: SharePointConfig | null } }>('/admin/sharepoint').then(wrap<SharePointConfig | null>),
  updateSharePoint: (body: Partial<SharePointConfig>) => apiClient.put('/admin/sharepoint', body),
  testSharePoint: () => apiClient.post('/admin/sharepoint/test'),

  // Logs
  getLogs: () => apiClient.get<{ data: { data: IngestionLog[] } }>('/admin/ingestion-log').then(wrap<IngestionLog[]>),
};
