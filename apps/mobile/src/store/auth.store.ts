import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { validInvitationCode } from "../lib/invitation";
import { googleSignOut } from "../lib/google";
import { forgetPushRegistration, registeredPushToken } from "../lib/push";
import { api, onSessionExpired } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import { forgetSessionData } from "../lib/localData";
import type { Usuario, AuthResponse } from "../types";

interface AuthState {
  usuario: Usuario | null;
  isLoaded: boolean;
  isAuthenticated: boolean;
  pendingInvitation: string | null;
  /** True when the server ended the session (not a manual logout), so login can explain why. */
  sessionExpired: boolean;
  signingOut: boolean;
  rememberInvitation: (code: string) => Promise<void>;
  clearInvitation: () => Promise<void>;

  login: (email: string, password: string) => Promise<void>;
  /** Exchanges a Google ID token for a JUNTO session. */
  loginWithGoogle: (idToken: string) => Promise<{ nuevo: boolean }>;
  register: (data: {
    nombre: string;
    email: string;
    celular?: string;
    password: string;
  }) => Promise<{ emailDelivery: boolean }>;
  completeVerification: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateUsuario: (data: Partial<Usuario>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  usuario: null,
  isLoaded: false,
  isAuthenticated: false,
  pendingInvitation: null,
  sessionExpired: false,
  signingOut: false,
  rememberInvitation: async (code) => {
    if (!validInvitationCode(code))
      throw new Error("Enlace de invitación inválido.");
    await AsyncStorage.setItem("pendingInvitation", code);
    set({ pendingInvitation: code });
  },
  clearInvitation: async () => {
    await AsyncStorage.removeItem("pendingInvitation");
    set({ pendingInvitation: null });
  },

  loadFromStorage: async () => {
    const pending = await AsyncStorage.getItem("pendingInvitation").catch(
      () => null,
    );
    set({ pendingInvitation: validInvitationCode(pending) ? pending : null });
    try {
      const token = await SecureStore.getItemAsync("accessToken");
      if (!token) {
        set({ isLoaded: true, isAuthenticated: false });
        return;
      }

      const { data } = await api.get<Usuario>("/auth/me");
      await SecureStore.setItemAsync("cachedUsuario", JSON.stringify(data));
      set({ usuario: data, isLoaded: true, isAuthenticated: true });
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response
        ?.status;
      if (status === 401 || status === 403) {
        await Promise.all(
          ["accessToken", "refreshToken", "cachedUsuario"].map((key) =>
            SecureStore.deleteItemAsync(key),
          ),
        );
        queryClient.clear();
        set({ isLoaded: true, isAuthenticated: false, usuario: null, sessionExpired: true });
      } else {
        const cached = await SecureStore.getItemAsync("cachedUsuario");
        let usuario = get().usuario;
        try {
          const value = cached ? JSON.parse(cached) : null;
          if (value?.id && value?.email) usuario = value;
        } catch {
          /* A damaged profile cache must not erase the tokens. */
        }
        set({ isLoaded: true, isAuthenticated: !!usuario, usuario });
      }
    }
  },

  login: async (email, password) => {
    const { data } = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });
    await SecureStore.setItemAsync("accessToken", data.accessToken);
    await SecureStore.setItemAsync("refreshToken", data.refreshToken);
    await SecureStore.setItemAsync(
      "cachedUsuario",
      JSON.stringify(data.usuario),
    );
    queryClient.clear();
    set({ usuario: data.usuario, isAuthenticated: true, sessionExpired: false });
  },

  loginWithGoogle: async (idToken) => {
    const { data } = await api.post<AuthResponse & { nuevo: boolean }>("/auth/google", { idToken });
    await SecureStore.setItemAsync("accessToken", data.accessToken);
    await SecureStore.setItemAsync("refreshToken", data.refreshToken);
    await SecureStore.setItemAsync("cachedUsuario", JSON.stringify(data.usuario));
    queryClient.clear();
    set({ usuario: data.usuario, isAuthenticated: true, sessionExpired: false });
    return { nuevo: data.nuevo };
  },

  register: async (formData) => {
    const { data } = await api.post<{ emailDelivery: boolean }>(
      "/auth/register",
      formData,
    );
    return data;
  },

  completeVerification: async (email, otp) => {
    const { data } = await api.post<AuthResponse>("/auth/verify-email", {
      email,
      otp,
    });
    await SecureStore.setItemAsync("accessToken", data.accessToken);
    await SecureStore.setItemAsync("refreshToken", data.refreshToken);
    await SecureStore.setItemAsync(
      "cachedUsuario",
      JSON.stringify(data.usuario),
    );
    queryClient.clear();
    set({ usuario: data.usuario, isAuthenticated: true, sessionExpired: false });
  },

  logout: async () => {
    if (get().signingOut) return;
    set({ signingOut: true });
    try {
      const userId = get().usuario?.id;
      const expoPushToken = userId ? await registeredPushToken(userId) : undefined;
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken, expoPushToken }).catch(() => undefined);
      }
      if (userId) await forgetPushRegistration(userId).catch(() => undefined);
      await SecureStore.deleteItemAsync("accessToken");
      await SecureStore.deleteItemAsync("refreshToken");
      await SecureStore.deleteItemAsync("cachedUsuario");
      await googleSignOut();
      await get().clearInvitation();
      await forgetSessionData();
      queryClient.clear();
      set({ usuario: null, isAuthenticated: false, sessionExpired: false });
    } finally { set({ signingOut: false }); }
  },

  updateUsuario: (data) => {
    const current = get().usuario;
    if (current) {
      const usuario = { ...current, ...data };
      set({ usuario });
      SecureStore.setItemAsync("cachedUsuario", JSON.stringify(usuario)).catch(
        () => undefined,
      );
    }
  },
}));
onSessionExpired(() => {
  queryClient.clear();
  useAuthStore.setState({
    usuario: null,
    isAuthenticated: false,
    isLoaded: true,
    sessionExpired: true,
  });
});
