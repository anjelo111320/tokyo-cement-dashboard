import { apiClient } from './api.client';

export interface AdminPlant {
  plant_id: string;
  name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  plant_type: string;
  is_active: boolean;
  is_new: boolean;
}

export interface AdminMaterial {
  material_id: string;
  description: string;
  brand_group: string | null;
  is_bag: boolean;
  is_bulk: boolean;
  is_active: boolean;
  is_new: boolean;
  /** Present in the ACTIVE dataset (uploaded or bundled CSV). Rows with
   * false are greyed out in the Materials tab — the material exists in the
   * DB but the current dataset has no data for it. */
  in_dataset: boolean;
}

export interface AdminDataset {
  id: string;
  filename: string;
  row_count: number;
  is_active: boolean;
  uploaded_at: string;
}

export interface DatasetListResponse {
  datasets: AdminDataset[];
  /** null = the bundled default CSV is active */
  active_dataset_id: string | null;
}

export interface AdminBrandGroup {
  id: string;
  label: string;
  sort_order: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
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

  // Datasets (uploaded inventory CSVs)
  getDatasets: () => apiClient.get<{ data: { data: DatasetListResponse } }>('/admin/datasets').then(wrap<DatasetListResponse>),
  uploadDataset: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post('/admin/datasets', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  activateDataset: (id: string) => apiClient.post(`/admin/datasets/${id}/activate`),
  activateDefaultDataset: () => apiClient.post('/admin/datasets/activate-default'),
  deleteDataset: (id: string) => apiClient.delete(`/admin/datasets/${id}`),

  // Brand groups
  getBrandGroups:   () => apiClient.get<{ data: { data: AdminBrandGroup[] } }>('/admin/brand-groups').then(wrap<AdminBrandGroup[]>),
  createBrandGroup: (label: string) => apiClient.post<{ data: { data: AdminBrandGroup } }>('/admin/brand-groups', { label }).then(wrap<AdminBrandGroup>),

  // Users
  getUsers: () => apiClient.get<{ data: { data: AdminUser[] } }>('/admin/users').then(wrap<AdminUser[]>),
  createUser: (body: { email: string; password: string; role: string }) => apiClient.post('/admin/users', body),
  updateUser: (id: string, body: { role?: string; is_active?: boolean }) => apiClient.put(`/admin/users/${id}`, body),

  // SharePoint
  getSharePoint: () => apiClient.get<{ data: { data: SharePointConfig | null } }>('/admin/sharepoint').then(wrap<SharePointConfig | null>),
  updateSharePoint: (body: Partial<SharePointConfig>) => apiClient.put('/admin/sharepoint', body),
  testSharePoint: () => apiClient.post('/admin/sharepoint/test'),
};
