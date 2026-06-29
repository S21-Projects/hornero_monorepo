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
 * Reads synchronous store state (populated by hydrate() from access_token cookie).
 * Trust level: UX routing only, same as proxy.ts.
 */
export function ProtectedRoute({
  allow,
  requireValidated = false,
  redirectTo = '/',
}: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tipo = useAuthStore((s) => s.tipo);
  const orgValidada = useAuthStore((s) => s.orgValidada);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

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
 * Redirects authenticated users away:
 *   - ADMINISTRADOR → /
 *   - REFERENTE / DONANTE → /dashboard
 */
export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tipo = useAuthStore((s) => s.tipo);

  if (isAuthenticated) {
    if (tipo === 'ADMINISTRADOR') return <Navigate to="/" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
