import { create } from 'zustand';
import { api } from '@/lib/axios';

export type UserRole = 'ADMINISTRADOR' | 'REFERENTE' | 'DONANTE';

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  tipo: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error('Credenciales inválidas');
    }
  },

  logout: async () => {
    await api.post('/auth/logout').catch(() => {});
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({
        user: data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },


}));
