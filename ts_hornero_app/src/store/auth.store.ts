import { create } from 'zustand';
import { api } from '@/lib/axios';
import { registerUser, type RegisterPayload } from '@/lib/api/auth';
import { createOrganizacion, type CreateOrganizacionPayload } from '@/lib/api/organizaciones';

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
  register: (
    userPayload: RegisterPayload,
    orgPayload: CreateOrganizacionPayload
  ) => Promise<void>;
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

  register: async (userPayload, orgPayload) => {
    // Step 1: create account
    await registerUser(userPayload);

    // Step 2: auto-login
    await api.post('/auth/login', {
      email: userPayload.email,
      password: userPayload.password,
    });

    // Step 3: load user (sets isAuthenticated)
    const store = useAuthStore.getState();
    await store.loadUser();

    // Step 4: create organization (useMyOrgQuery will fetch org status automatically)
    await createOrganizacion(orgPayload);
  },
}));
