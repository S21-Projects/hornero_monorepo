import { Navigate, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/auth.store';
import type { UserRole } from '../store/auth.store';

interface ProtectedRouteProps {
  /** Roles permitted to access this route group. */
  allow: UserRole[];
  /**
   * When true, REFERENTE users must have their organization validated.
   * Unvalidated REFERENTE → /pending-validation.
   * Does not affect other roles.
   */
  requireValidated?: boolean;
  /**
   * Where to redirect when the authenticated user's role is not in `allow`.
   * Defaults to '/'.
   */
  redirectTo?: string;
}

/**
 * Layout route guard — mirrors the proxy.ts server-side guard matrix.
 *
 * The guard is async-aware:
 * - 'loading'         → render a minimal loader; do NOT redirect (role not resolved yet).
 * - 'unauthenticated' → redirect to /login.
 * - 'authenticated'   → apply the role matrix using store.user.tipo (NOT a decoded cookie).
 *
 * Trust level: UX routing only, same as proxy.ts.
 */
export function ProtectedRoute({
  allow,
  requireValidated = false,
  redirectTo = '/',
}: ProtectedRouteProps) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const orgValidada = useAuthStore((s) => s.orgValidada);

  if (status === 'loading') {
    // Role is being resolved via GET /auth/me — do not redirect yet.
    return <div aria-busy="true" aria-label="Loading..." />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  // status === 'authenticated'
  const tipo = user?.tipo;
  if (!tipo || !allow.includes(tipo)) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requireValidated && tipo === 'REFERENTE' && !orgValidada) {
    return <Navigate to="/pending-validation" replace />;
  }

  return <Outlet />;
}

interface PublicOnlyRouteProps {
  children: ReactNode;
}

/**
 * Inverse guard for /login and /register.
 * - 'loading'         → render loader (role not resolved; premature redirect would break UX).
 * - 'authenticated'   → redirect to role home.
 * - 'unauthenticated' → render the public page.
 */
export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status === 'loading') {
    return <div aria-busy="true" aria-label="Loading..." />;
  }

  if (status === 'authenticated') {
    if (user?.tipo === 'ADMINISTRADOR') return <Navigate to="/" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
