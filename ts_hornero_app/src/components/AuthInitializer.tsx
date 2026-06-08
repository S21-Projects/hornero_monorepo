'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useMyOrgQuery } from '@/hooks/useMyOrgQuery';

export default function AuthInitializer() {
  const loadUser = useAuthStore((s) => s.loadUser);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: myOrgData, isLoading: isOrgLoading } = useMyOrgQuery();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clear org_validada when not authenticated
      document.cookie = 'org_validada=; path=/; max-age=0';
      return;
    }

    if (user?.tipo !== 'REFERENTE') {
      // Non-referente users don't need this cookie
      return;
    }

    // Don't write while org query is still loading (safe default = absent = pending)
    if (isOrgLoading) {
      return;
    }

    if (myOrgData?.validada === true) {
      document.cookie = 'org_validada=true; path=/';
    } else {
      // data === null (no org) or validada === false → pending
      document.cookie = 'org_validada=false; path=/';
    }
  }, [isAuthenticated, user, myOrgData, isOrgLoading]);

  return null;
}
