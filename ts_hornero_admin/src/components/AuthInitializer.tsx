import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useMiOrganizacion } from '../lib/hooks/useMiOrganizacion';

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
 * 3. For REFERENTE sessions, fetches GET /organizaciones/mia reactively so that
 *    orgChecked + orgValidada are set both on cold boot and after in-session login.
 *    Uses the shared queryKey ['organizaciones','mia'] — NeedsPage deduplicates.
 */
export function AuthInitializer({ children }: AuthInitializerProps) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const loadUser = useAuthStore((s) => s.loadUser);
  const status = useAuthStore((s) => s.status);
  const tipo = useAuthStore((s) => s.user?.tipo);
  const setOrgValidada = useAuthStore((s) => s.setOrgValidada);

  useEffect(() => {
    hydrate();
    // Read status synchronously after hydrate() — Zustand setState is synchronous.
    if (useAuthStore.getState().status === 'loading') {
      void loadUser();
    }
  }, [hydrate, loadUser]);

  // Drive org-check from reactive query so it fires both on cold boot and after
  // in-session login() (status transitions from 'unauthenticated' → 'authenticated').
  const orgQuery = useMiOrganizacion({
    enabled: status === 'authenticated' && tipo === 'REFERENTE',
  });

  useEffect(() => {
    // Any successful response must advance orgChecked, even a 200 with a null
    // body — otherwise a REFERENTE would be stuck on the loader indefinitely.
    if (orgQuery.isSuccess) {
      setOrgValidada(orgQuery.data?.validada ?? false);
    } else if (orgQuery.isError) {
      setOrgValidada(false);
    }
  }, [orgQuery.isSuccess, orgQuery.isError, orgQuery.data, setOrgValidada]);

  return <>{children}</>;
}
