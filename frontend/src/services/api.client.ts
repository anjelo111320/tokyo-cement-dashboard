import axios from 'axios';
import { config } from '@/constants/config';

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: `${config.apiBaseUrl}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
  withCredentials: true,   // send httpOnly auth cookies on every request
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error)) {
      // On 401: try refresh once, then redirect to login.
      // Skip for auth endpoints — /auth/me and /auth/refresh handle their own 401s.
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      if (error.response?.status === 401 && !error.config?._retry && !isAuthEndpoint) {
        if (error.config) {
          error.config._retry = true;
        }
        try {
          await axios.post(`${config.apiBaseUrl}/api/v1/auth/refresh`, {}, { withCredentials: true });
          return apiClient(error.config!);
        } catch {
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }
      }
      const message = (error.response?.data as { error?: { message?: string } } | undefined)
        ?.error?.message ?? error.message;
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error);
  },
);
