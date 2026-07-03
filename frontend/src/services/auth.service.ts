import { apiClient } from './api.client';

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'viewer';
}

export const authService = {
  async login(email: string, password: string): Promise<AuthUser> {
    const res = await apiClient.post<{ success: boolean; data: AuthUser }>('/auth/login', { email, password });
    return res.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async me(): Promise<AuthUser> {
    const res = await apiClient.get<{ success: boolean; data: AuthUser }>('/auth/me');
    return res.data.data;
  },
};
