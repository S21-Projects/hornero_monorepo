import { PendingValidationCard } from '../components/PendingValidationCard';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useAuthStore } from '../store/auth.store';

/**
 * Standalone screen for REFERENTE users who don't yet have a validated organización.
 * Re-uses the cached useMisOrganizaciones result from AuthInitializer (no extra request).
 *
 * Two distinct cases (referente-onboarding spec — partial-failure retry):
 * - orgCount === 0: the referente's account exists but organización creation
 *   never succeeded; resumable entry point to /mis-organizaciones.
 * - orgCount > 0: organización(es) exist but none are validada yet; CTA to /acreditacion.
 *
 * /dashboard and /needs render the same card inside the AppShell instead of
 * redirecting here.
 */
export default function PendingValidationPage() {
  const { data: orgs } = useMisOrganizaciones();
  const orgCount = useAuthStore((s) => s.orgCount);

  const orgNombre = orgCount === 0 ? null : (orgs?.[0]?.nombre ?? '');

  return <PendingValidationCard orgNombre={orgNombre} showLogout style={{ margin: '80px auto' }} />;
}
