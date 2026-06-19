import { RoutePaths } from "@presentation/utils/routes";
import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import toast from "react-hot-toast";
import { enqueueRequest, registerOnlineListener } from "./offline-queue";
import { requestQueue } from "./request-queue";

interface ApiError {
  config: AxiosRequestConfig & {
    _retry?: boolean;
    _retryCount?: number;
  };
  response?: AxiosResponse;
}

const base = import.meta.env.VITE_API_URL as string;

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};

// Configuración de Axios
const api = axios.create({
  baseURL: base,
  headers,
  withCredentials: true,
});

// Register online listener to flush the offline queue when connectivity returns
registerOnlineListener(api);

/** Status codes that indicate the backend is unreachable (e.g., Vite proxy returning 502). */
const PROXY_UNAVAILABLE_CODES = [502, 503, 504];

const refreshToken = async (): Promise<void> => {
  try {
    // No enviamos nada, el navegador enviará la cookie 'refreshToken' sola
    await api.post("/auth/refresh", {});
  } catch (error) {
    throw new Error("Failed to refresh token");
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: ApiError) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest.url?.includes("/auth/login")
    ) {
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

        window.localStorage.removeItem("refreshToken");
        window.localStorage.removeItem("accessToken");

        toast.error("Tu sesión ha expirado por inactividad");

        window.location.href = `${RoutePaths.Auth}/${RoutePaths.Login}`;

        return Promise.reject(refreshError);
      }
    }

    // Network error (ERR_NETWORK) OR proxy unavailable (502/503/504 via Vite) —
    // backend is unreachable or user is offline. Queue mutations for retry.
    const isNetworkError = !error.response;
    const isProxyError =
      error.response && PROXY_UNAVAILABLE_CODES.includes(error.response.status);

    if (isNetworkError || isProxyError) {
      const method = originalRequest.method?.toUpperCase() || "";
      const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

      if (isMutation) {
        // Strip the baseURL prefix so the URL is stored as a relative path.
        // When flushQueue replays through the same axios instance (which has baseURL),
        // it will correctly re-combine them without doubling.
        const baseURL = api.defaults.baseURL || "";
        let relativeUrl = originalRequest.url || "";
        if (baseURL && relativeUrl.startsWith(baseURL)) {
          relativeUrl = relativeUrl.slice(baseURL.length);
        }
        // Ensure it starts with /
        if (!relativeUrl.startsWith("/")) {
          relativeUrl = "/" + relativeUrl;
        }
        enqueueRequest(method, relativeUrl, originalRequest.data);
        // Return a resolved promise so the caller doesn't see an error and the
        // mutation's onSuccess fires, closing modals and providing feedback.
        return Promise.resolve({
          data: {
            _offline: true,
            _queued: true,
            message: "Saved offline — will sync when connection returns",
          },
        });
      }
    }

    return Promise.reject(error);
  },
);

export default api;
