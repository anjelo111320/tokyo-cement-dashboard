import axios from 'axios';
import { config } from '@/constants/config';

export const apiClient = axios.create({
  baseURL: `${config.apiBaseUrl}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const message = (error.response?.data as { error?: { message?: string } } | undefined)
        ?.error?.message ?? error.message;
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error);
  },
);
