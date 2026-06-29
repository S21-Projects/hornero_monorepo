import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/auth.store';

// useMyOrgQuery is STUBBED — will be implemented in Slice 5 once the
// REFERENTE org endpoint is wired end-to-end with the BFF.

interface AuthInitializerProps {
  children: ReactNode;
}

/**
 * Mounts once at the app root.
 * 1. hydrate() — synchronous: checks session_hint cookie.
 *    If present → status='loading' (session may exist, role unknown).
 *    If absent  → status='unauthenticated' (no further network call).
 * 2. If status is 'loading' after hydrate, calls loadUser() → GET /auth/me
 *    to resolve the role. On success: status='authenticated'. On failure: 'unauthenticated'.
 */
export function AuthInitializer({ children }: AuthInitializerProps) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    hydrate();
    // Read status synchronously after hydrate() — Zustand setState is synchronous.
    if (useAuthStore.getState().status === 'loading') {
      void loadUser();
    }
  }, [hydrate, loadUser]);

  return <>{children}</>;
}
