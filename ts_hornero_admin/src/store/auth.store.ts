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
  /**
   * From GET /auth/me (populated by JwtStrategy.validate() → JWT claim).
   * Can be stale for up to 15 min after verification — the MS enforcement on
   * writes always reads the DB, this field is UI-gating only.
   */
  emailVerificado: boolean;
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
  /** True when at least one owned organización has estado APROBADA. */
  orgValidada: boolean;
  /**
   * True once GET /organizaciones/mia has settled (success or error) for the current
   * session. Guards the REFERENTE+requireValidated branch so we don't redirect prematurely
   * during the window between status='authenticated' and the mia query resolving.
   */
  orgChecked: boolean;
  /**
   * Count of organizaciones owned by the current referente (0..3). Lets
   * /pending-validation distinguish "no org yet, resume registration" (0)
   * from "org(s) exist but none validated yet" (>0).
   */
  orgCount: number;

  /**
   * Sets orgValidada + orgCount from the list of owned organizaciones AND marks
   * orgChecked=true. Called by AuthInitializer once GET /organizaciones/mia
   * settles (with the real list on success, count 0 / validada false on error).
   */
  setOrgValidada(validada: boolean, count?: number): void;

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
  // Seeded synchronously from session_hint: route guards render BEFORE AuthInitializer's
  // effect (child effects run first), so a hard-loaded deep link must already see
  // 'loading' — not 'unauthenticated' — or it is bounced to /login and then to role home.
  status: hasCookie('session_hint') ? 'loading' : 'unauthenticated',
  orgValidada: false,
  orgChecked: false,
  orgCount: 0,

  setOrgValidada(validada: boolean, count = 0) {
    set({ orgValidada: validada, orgChecked: true, orgCount: count });
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
      set({ user: null, status: 'unauthenticated', orgValidada: false, orgChecked: false, orgCount: 0 });
      window.location.href = '/login';
    }
  },
}));
