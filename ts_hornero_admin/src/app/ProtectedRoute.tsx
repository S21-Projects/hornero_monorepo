import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/auth.store';
import type { UserRole } from '../store/auth.store';
import { roleHome } from '../lib/roleHome';

interface ProtectedRouteProps {
  /** Roles permitted to access this route group. */
  allow: UserRole[];
  /**
   * When true, any role must have a verified email. Unverified → /verify-email.
   * Checked BEFORE requireValidated — the two gates are independent and never
   * merged (email verification is user-owned, org approval is admin-owned).
   */
  requireVerified?: boolean;
  /**
   * When true, REFERENTE users must have their organization validated.
   * Unvalidated REFERENTE → /pending-validation.
   * Does not affect other roles.
   */
  requireValidated?: boolean;
  /**
   * Where to redirect when the authenticated user's role is not in `allow`.
   * Defaults to the denied user's own roleHome() — NOT '/', which used to be
   * a redirect-only node and could cycle back through PublicOnlyRoute/RootRedirect.
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
  requireVerified = false,
  requireValidated = false,
  redirectTo,
}: ProtectedRouteProps) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const orgValidada = useAuthStore((s) => s.orgValidada);
  const orgChecked = useAuthStore((s) => s.orgChecked);
  const location = useLocation();

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
    return <Navigate to={redirectTo ?? roleHome(tipo as UserRole)} replace />;
  }

  if (requireVerified && !user?.emailVerificado) {
    return <Navigate to="/verify-email" replace state={{ from: location.pathname }} />;
  }

  if (requireValidated && tipo === 'REFERENTE') {
    // Wait for the mia query to settle (orgChecked=false means AuthInitializer hasn't
    // finished yet). Redirecting early would bounce a valid referente to /pending-validation.
    if (!orgChecked) {
      return <div aria-busy="true" aria-label="Loading..." />;
    }
    if (!orgValidada) {
      return <Navigate to="/pending-validation" replace />;
    }
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

  if (status === 'authenticated' && user) {
    return <Navigate to={roleHome(user.tipo)} replace />;
  }

  return <>{children}</>;
}
