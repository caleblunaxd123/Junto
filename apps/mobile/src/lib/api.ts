import axios, {
  create as createAxios,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import * as SecureStore from "./tokenStorage";
import { isAuthEntry } from "./authEntry";
import { requireSession, sessionGeneration } from './sessionGeneration';

type SessionRequest = InternalAxiosRequestConfig & { _sessionGeneration?: number; _retry?: boolean };

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const api = createAxios({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: { "Content-Type": "application/json", "X-Junto-Currency-Version": "1" },
});

// Attach access token to every request
api.interceptors.request.use(async (config: SessionRequest) => {
  const generation = config._sessionGeneration ?? sessionGeneration();
  requireSession(generation);
  config._sessionGeneration = generation;
  const token = await SecureStore.getItemAsync("accessToken");
  requireSession(generation);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.url === "/auth/push-token") {
    // A retry after refresh must use the rotated credential, not a stale body.
    const refreshToken = await SecureStore.getItemAsync("refreshToken");
    requireSession(generation);
    if (!refreshToken) throw new Error("Session ended before notification registration");
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    config.data = { ...body, refreshToken };
  }
  return config;
});

let sessionExpiredListener: (() => void) | undefined;
export function onSessionExpired(listener: () => void) {
  sessionExpiredListener = listener;
}
async function expireSession(generation: number) {
  requireSession(generation);
  await Promise.all(
    ["accessToken", "refreshToken", "cachedUsuario"].map((key) =>
      SecureStore.deleteItemAsync(key),
    ),
  );
  if (generation === sessionGeneration()) sessionExpiredListener?.();
}
let refreshing: { generation: number; promise: Promise<string> } | undefined;
function refreshAccess(generation: number): Promise<string> {
  if (refreshing?.generation === generation) return refreshing.promise;
  const task = { generation, promise: Promise.resolve('') };
  task.promise = (async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      requireSession(generation);
      if (!refreshToken) {
        await expireSession(generation);
        throw new Error('Session expired');
      }
      const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken }, { timeout: 15000 });
      requireSession(generation);
      await SecureStore.setItemAsync('accessToken', data.accessToken);
      requireSession(generation);
      await SecureStore.setItemAsync('refreshToken', data.refreshToken);
      requireSession(generation);
      return data.accessToken as string;
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (status === 401 || status === 403) await expireSession(generation);
      throw error;
    } finally {
      if (refreshing === task) refreshing = undefined;
    }
  })();
  refreshing = task;
  return task.promise;
}

// Auto-refresh access token on 401
api.interceptors.response.use(
  (response) => { requireSession((response.config as SessionRequest)._sessionGeneration ?? sessionGeneration()); return response; },
  async (error: AxiosError) => {
    const originalRequest = error.config as SessionRequest;
    const generation = originalRequest?._sessionGeneration ?? sessionGeneration();
    requireSession(generation);

    const authEntry = isAuthEntry(originalRequest?.url);
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !authEntry
    ) {
      originalRequest._retry = true;
      const token = await refreshAccess(generation);
      requireSession(generation);
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return api(originalRequest);
    }
    if (error.response?.status === 401 && originalRequest?._retry && !authEntry)
      await expireSession(generation);
    return Promise.reject(error);
  },
);
