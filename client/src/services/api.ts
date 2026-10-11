import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { ApiResult } from '@fleetwise/shared';

// ─── Axios instance ───────────────────────────────────────────────────────────

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const custom = typeof window !== 'undefined' ? localStorage.getItem('fleet_api_url') : null;
  if (custom) return custom;
  
  if (typeof window !== 'undefined') {
    const isCapacitor = Boolean((window as any).Capacitor?.isNativePlatform?.() || window.location.protocol === 'capacitor:');
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    
    // Fallback to Render backend when deployed to Vercel or running on Mobile APK
    if (isCapacitor || !isLocal) {
      return 'https://fleet365-api.onrender.com/api/v1';
    }
  }

  return '/api/v1';
}

export function getServerHostUrl(): string {
  const base = getApiBaseUrl();
  if (base.startsWith('http')) {
    return base.replace(/\/api\/v1\/?$/, '');
  }
  return '';
}

const API_BASE = getApiBaseUrl();

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send cookies (refresh token)
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Access token management ──────────────────────────────────────────────────

let accessToken: string | null = null;
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ─── Request interceptor: attach Bearer token ─────────────────────────────────

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  // Attach business context header from localStorage
  const businessId = localStorage.getItem('fw_business_id');
  if (businessId) {
    config.headers['X-Business-Id'] = businessId;
  }

  return config;
});

// ─── Response interceptor: handle 401 and token refresh ──────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/')
    ) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiClient.post<{ success: true; data: { accessToken: string } }>(
          '/auth/refresh',
        );
        const newToken = data.data.accessToken;
        setAccessToken(newToken);

        // Flush queued requests
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        refreshQueue.forEach((cb) => cb(null));
        refreshQueue = [];
        setAccessToken(null);
        localStorage.removeItem('fw_business_id');
        window.dispatchEvent(new CustomEvent('fw:session-expired'));
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Typed API helpers ────────────────────────────────────────────────────────

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res: AxiosResponse<ApiResult<T>> = await apiClient.get(url, { params });
  if (!res.data.success) throw new Error((res.data as { error: { message: string } }).error.message);
  return res.data.data;
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const res: AxiosResponse<ApiResult<T>> = await apiClient.post(url, data);
  if (!res.data.success) throw new Error((res.data as { error: { message: string } }).error.message);
  return res.data.data;
}

export async function apiPatch<T>(url: string, data?: unknown): Promise<T> {
  const res: AxiosResponse<ApiResult<T>> = await apiClient.patch(url, data);
  if (!res.data.success) throw new Error((res.data as { error: { message: string } }).error.message);
  return res.data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res: AxiosResponse<ApiResult<T>> = await apiClient.delete(url);
  if (!res.data.success) throw new Error((res.data as { error: { message: string } }).error.message);
  return res.data.data;
}
