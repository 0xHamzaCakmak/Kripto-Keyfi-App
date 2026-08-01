import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export const api = axios.create({ baseURL: apiUrl, withCredentials: true });

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() { return accessToken; }

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const isAuthRequest = config?.url?.includes('/auth/login') || config?.url?.includes('/auth/refresh');
    if (error.response?.status !== 401 || !config || config._retry || isAuthRequest) throw error;
    config._retry = true;

    refreshPromise ??= axios.post<{ data: { accessToken: string } }>(`${apiUrl}/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        const token = response.data.data.accessToken;
        setAccessToken(token);
        window.dispatchEvent(new Event('kriptokeyfi-session-refreshed'));
        return token;
      })
      .catch((refreshError) => {
        setAccessToken(null);
        window.dispatchEvent(new Event('kriptokeyfi-session-expired'));
        throw refreshError;
      })
      .finally(() => { refreshPromise = null; });

    const token = await refreshPromise;
    config.headers.Authorization = `Bearer ${token}`;
    return api(config);
  },
);

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
