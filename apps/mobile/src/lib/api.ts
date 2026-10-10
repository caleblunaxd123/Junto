import axios, {
  create as createAxios,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import * as SecureStore from "./tokenStorage";
import { isAuthEntry } from "./authEntry";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const api = createAxios({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach access token to every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.url === "/auth/push-token") {
    // A retry after refresh must use the rotated credential, not a stale body.
    const refreshToken = await SecureStore.getItemAsync("refreshToken");
    if (!refreshToken) throw new Error("Session ended before notification registration");
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    config.data = { ...body, refreshToken };
  }
  return config;
});

let isRefreshing = false;
let sessionExpiredListener: (() => void) | undefined;
export function onSessionExpired(listener: () => void) {
  sessionExpiredListener = listener;
}
async function expireSession() {
  await Promise.all(
    ["accessToken", "refreshToken", "cachedUsuario"].map((key) =>
      SecureStore.deleteItemAsync(key),
    ),
  );
  sessionExpiredListener?.();
}
let failedQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
}

// Auto-refresh access token on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const authEntry = isAuthEntry(originalRequest?.url);
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !authEntry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync("refreshToken");
        if (!refreshToken) {
          await expireSession();
          throw new Error("Session expired");
        }

        const { data } = await axios.post(
          `${API_URL}/api/auth/refresh`,
          { refreshToken },
          { timeout: 15000 },
        );
        await SecureStore.setItemAsync("accessToken", data.accessToken);
        await SecureStore.setItemAsync("refreshToken", data.refreshToken);

        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        const status = (refreshError as AxiosError).response?.status;
        if (status === 401 || status === 403) await expireSession();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    if (error.response?.status === 401 && originalRequest?._retry && !authEntry)
      await expireSession();
    return Promise.reject(error);
  },
);
