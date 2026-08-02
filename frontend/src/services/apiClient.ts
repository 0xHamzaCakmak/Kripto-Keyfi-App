import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Use the same origin by default so production requests pass through the
// web server's /api reverse proxy instead of pointing visitors at localhost.
export const apiUrl = import.meta.env.VITE_API_URL || '/api';
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export const api = axios.create({ baseURL: apiUrl, withCredentials: true, timeout: 15_000 });

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
    const isAuthRequest = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh']
      .some((path) => config?.url?.includes(path));
    if (error.response?.status !== 401 || !config || config._retry || isAuthRequest) throw error;
    config._retry = true;

    if (!refreshPromise) window.dispatchEvent(new Event('kriptokeyfi-session-refreshing'));
    refreshPromise ??= axios.post<{ data: { accessToken: string } }>(`${apiUrl}/auth/refresh`, {}, { withCredentials: true, timeout: 15_000 })
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
  if (axios.isAxiosError<{ error?: { message?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } } }>(error)) {
    const apiError = error.response?.data?.error;
    const fieldMessage = apiError?.details?.fieldErrors
      ? Object.values(apiError.details.fieldErrors).flat().find(Boolean)
      : undefined;
    const formMessage = apiError?.details?.formErrors?.find(Boolean);
    return fieldMessage || formMessage || apiError?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
