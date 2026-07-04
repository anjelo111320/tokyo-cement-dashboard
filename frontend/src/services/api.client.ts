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
  // 60s: Render free tier spins the backend down when idle; the first request
  // after idle waits through a ~50s cold start. 15s made that request fail.
  timeout: 60_000,
  withCredentials: true,   // send httpOnly auth cookies on every request
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error)) {
      // On 401: try refresh once, then redirect to login.
      // Skip only /auth/login (no session yet) and /auth/refresh (would retry itself
      // forever). /auth/me MUST go through the refresh-and-retry path below — it's
      // the call that restores a session after the short-lived access token expires,
      // and skipping it here was silently discarding valid 7-day refresh sessions.
      const url = error.config?.url ?? '';
      const skipRefresh = url.includes('/auth/login') || url.includes('/auth/refresh');
      if (error.response?.status === 401 && !error.config?._retry && !skipRefresh) {
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
      // Surface the most specific message the backend gave us:
      // AppError envelope → FastAPI HTTPException detail → axios default.
      const data = error.response?.data as { error?: { message?: string }; detail?: string } | undefined;
      const message = data?.error?.message ?? data?.detail ?? error.message;
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error);
  },
);
