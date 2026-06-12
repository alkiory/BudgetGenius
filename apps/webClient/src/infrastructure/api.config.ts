import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import { requestQueue } from './request-queue';
import { RoutePaths } from '@presentation/utils/routes';
import { enqueueRequest, registerOnlineListener } from './offline-queue';

interface ApiError {
  config: AxiosRequestConfig & {
    _retry?: boolean;
    _retryCount?: number;
  };
  response?: AxiosResponse;
}

const base = import.meta.env.VITE_API_URL as string;

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};

// Configuración de Axios
const api = axios.create({
  baseURL: base,
  headers,
  withCredentials: true,
});

// Register online listener to flush the offline queue when connectivity returns
registerOnlineListener(api);

const refreshToken = async (): Promise<void> => {
  try {
    // No enviamos nada, el navegador enviará la cookie 'refreshToken' sola
    await api.post('/auth/refresh', {});
  } catch (error) {
    throw new Error('Failed to refresh token');
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: ApiError) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }

    // Lógica para el resto de rutas protegidas
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await refreshToken();
        return api(originalRequest);
      } catch (refreshError) {
        requestQueue.process(refreshError);

        window.localStorage.removeItem('refreshToken');
        window.localStorage.removeItem('accessToken');

        toast.error('Tu sesión ha expirado por inactividad');

        window.location.href = `${RoutePaths.Auth}/${RoutePaths.Login}`;

        return Promise.reject(refreshError);
      }
    }

    // Network error (ERR_NETWORK) — backend is unreachable or user is offline
    if (!error.response) {
      const method = originalRequest.method?.toUpperCase() || '';
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      if (isMutation) {
        enqueueRequest(method, originalRequest.url || '', originalRequest.data);
        toast.error('Saved offline — will sync when connection returns', { duration: 3000 });
        // Return a resolved promise so the caller doesn't see an error
        return Promise.resolve({ data: { _offline: true, _queued: true } });
      }
    }

    return Promise.reject(error);
  }
);

export default api;