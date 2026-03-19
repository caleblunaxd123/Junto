import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../lib/api';
import type { Usuario, AuthResponse } from '../types';

interface AuthState {
  usuario: Usuario | null;
  isLoaded: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    nombre: string;
    email: string;
    celular: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateUsuario: (data: Partial<Usuario>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  usuario: null,
  isLoaded: false,
  isAuthenticated: false,

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        set({ isLoaded: true, isAuthenticated: false });
        return;
      }

      const { data } = await api.get<Usuario>('/auth/me');
      set({ usuario: data, isLoaded: true, isAuthenticated: true });
    } catch {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      set({ isLoaded: true, isAuthenticated: false, usuario: null });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    set({ usuario: data.usuario, isAuthenticated: true });
  },

  register: async (formData) => {
    const { data } = await api.post<AuthResponse>('/auth/register', formData);
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    set({ usuario: data.usuario, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    set({ usuario: null, isAuthenticated: false });
  },

  updateUsuario: (data) => {
    const current = get().usuario;
    if (current) set({ usuario: { ...current, ...data } });
  },
}));
