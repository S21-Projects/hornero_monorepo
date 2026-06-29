import { create } from 'zustand';
import { api } from '../lib/axios';
import { decodeToken } from '../lib/auth/jwt';

// Union type — not enum (TS6 erasableSyntaxOnly constraint).
export type UserRole = 'ADMINISTRADOR' | 'REFERENTE' | 'DONANTE';

export interface AuthUser {
  id: number;
  email: string;
  nombre: string;
  tipo: UserRole;
}

export interface AuthState {
  user: AuthUser | null;
  tipo: UserRole | null;
  isAuthenticated: boolean;
  orgValidada: boolean;
  isLoading: boolean;

  /**
   * Synchronously reads `access_token` + `org_validada` cookies and
   * populates tipo / orgValidada without any network call.
   * Mirrors the trust level of proxy.ts in ts_hornero_app.
   */
  hydrate(): void;

  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  loadUser(): Promise<void>;
}

function getCookieValue(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tipo: null,
  isAuthenticated: false,
  orgValidada: false,
  isLoading: false,

  hydrate() {
    const raw = getCookieValue('access_token');
    if (!raw) {
      set({ tipo: null, isAuthenticated: false });
      return;
    }
    const decoded = decodeToken(raw);
    if (!decoded) {
      set({ tipo: null, isAuthenticated: false });
      return;
    }
    const orgValidada = getCookieValue('org_validada') === 'true';
    set({ tipo: decoded.tipo, isAuthenticated: true, orgValidada });
  },

  async login(email: string, password: string) {
    set({ isLoading: true });
    try {
      await api.post('/auth/login', { email, password });
      await get().loadUser();
    } finally {
      set({ isLoading: false });
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      set({
        user: null,
        tipo: null,
        isAuthenticated: false,
        orgValidada: false,
      });
      window.location.href = '/login';
    }
  },

  async loadUser() {
    set({ isLoading: true });
    try {
      const res = await api.get<AuthUser>('/auth/me');
      const u = res.data;
      set({
        user: u,
        tipo: u.tipo,
        isAuthenticated: true,
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));
