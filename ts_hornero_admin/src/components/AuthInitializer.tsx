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
 * 1. Calls hydrate() — synchronous cookie decode → populates tipo / orgValidada
 * 2. Calls loadUser() — GET /auth/me to enrich full user object
 *
 * Errors from loadUser are swallowed silently; anonymous visitors or users
 * with expired tokens should not see a crash on startup.
 */
export function AuthInitializer({ children }: AuthInitializerProps) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    hydrate();
    void loadUser().catch(() => {
      // Silent: no active session or network error on startup.
    });
  }, [hydrate, loadUser]);

  return <>{children}</>;
}
