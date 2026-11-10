import type { UserRole } from '../store/auth.store';

const ROLE_HOME: Record<UserRole, string> = {
  ADMINISTRADOR: '/admin',
  REFERENTE: '/dashboard',
  DONANTE: '/explorar',
};

/**
 * Single source of truth for a role's landing route.
 * Consumed by RootRedirect ('/'), PublicOnlyRoute's authenticated branch,
 * and ProtectedRoute's default redirectTo — every consumer breaks the
 * historical redirect loop that used to hub through '/'.
 *
 * Defensive fallback to '/login' for a null/unknown role — should not be
 * reachable when `tipo` comes from an authenticated store state, but keeps
 * the function total.
 */
export function roleHome(tipo: UserRole): string {
  return ROLE_HOME[tipo] ?? '/login';
}
