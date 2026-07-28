import { create } from 'zustand';
import { api } from '../lib/axios';

// Union type — not enum (TS6 erasableSyntaxOnly constraint).
export type UserRole = 'ADMINISTRADOR' | 'REFERENTE' | 'DONANTE';

export interface AuthUser {
  // Field name matches JwtStrategy.validate() return: { userId: payload.sub, ... }
  userId: number;
  email: string;
  nombre: string;
  tipo: UserRole;
}

export interface AuthState {
  user: AuthUser | null;
  /**
   * Explicit async status:
   * - 'unauthenticated': no session cookie, not logged in
   * - 'loading': session_hint present but role not yet resolved (GET /auth/me pending)
   * - 'authenticated': user + role loaded from /auth/me
   */
  status: 'loading' | 'authenticated' | 'unauthenticated';
  orgValidada: boolean;
  /**
   * True once GET /organizaciones/mia has settled (success or error) for the current
   * session. Guards the REFERENTE+requireValidated branch so we don't redirect prematurely
   * during the window between status='authenticated' and the mia query resolving.
   */
  orgChecked: boolean;

  /**
   * Sets orgValidada AND marks orgChecked=true. Called by AuthInitializer once
   * GET /organizaciones/mia settles (with true/false on success, false on error).
   */
  setOrgValidada(validada: boolean): void;

  /**
   * Synchronous boot step: checks session_hint cookie (JS-readable, httpOnly:false).
   * If present → status='loading' (a session likely exists; role unknown until loadUser()).
   * If absent  → status='unauthenticated'.
   * Does NOT make any network request.
   */
  hydrate(): void;

  /**
   * Async role resolution: GET /auth/me (sends httpOnly access_token automatically).
   * On success → sets user + status='authenticated'.
   * On 401/error → clears user + status='unauthenticated'.
   */
  loadUser(): Promise<void>;

  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

function hasCookie(name: string): boolean {
  return (
    typeof document !== 'undefined' &&
    document.cookie.split('; ').some((row) => row.startsWith(`${name}=`))
  );
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'unauthenticated',
  orgValidada: false,
  orgChecked: false,

  setOrgValidada(validada: boolean) {
    set({ orgValidada: validada, orgChecked: true });
  },

  hydrate() {
    if (hasCookie('session_hint')) {
      set({ status: 'loading' });
    } else {
      set({ status: 'unauthenticated' });
    }
  },

  async loadUser() {
    try {
      const res = await api.get<AuthUser>('/auth/me');
      const u = res.data;
      set({ user: u, status: 'authenticated' });
    } catch {
      set({ user: null, status: 'unauthenticated' });
    }
  },

  async login(email: string, password: string) {
    // POST /auth/login sets httpOnly cookies; BFF returns { user: {...} }.
    // Call loadUser() afterwards to get the role from /auth/me with guaranteed shape.
    await api.post('/auth/login', { email, password });
    await get().loadUser();
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      set({ user: null, status: 'unauthenticated', orgValidada: false, orgChecked: false });
      window.location.href = '/login';
    }
  },
}));
