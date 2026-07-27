import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { roleHome } from '../lib/roleHome';

/**
 * Root ('/') route element. Replaces the old unconditional
 * `<Navigate to="/login" replace />`, which was the hub of the redirect
 * loop: an authenticated ADMIN landing on '/' via PublicOnlyRoute would be
 * bounced straight back to '/login', which — for an authenticated user —
 * redirects back to '/', repeating forever.
 *
 * - 'loading'         → render a minimal loader; role not resolved yet.
 * - 'authenticated'   → redirect to the role's home via roleHome().
 * - 'unauthenticated' → redirect to /login.
 */
export function RootRedirect() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status === 'loading') {
    return <div aria-busy="true" aria-label="Loading..." />;
  }

  if (status === 'authenticated' && user) {
    return <Navigate to={roleHome(user.tipo)} replace />;
  }

  return <Navigate to="/login" replace />;
}
