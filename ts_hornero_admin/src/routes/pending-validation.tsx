import { useNavigate } from 'react-router-dom';
import { Text } from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useAuthStore } from '../store/auth.store';

/**
 * Shown to REFERENTE users who don't yet have a validated organización.
 * Re-uses the cached useMisOrganizaciones result from AuthInitializer (no extra request).
 *
 * Two distinct cases (referente-onboarding spec — partial-failure retry):
 * - orgCount === 0: the referente's account exists but organización creation
 *   never succeeded (registration failed after account creation, or was
 *   abandoned). Resumable entry point to /mis-organizaciones instead of a
 *   dead-end waiting screen.
 * - orgCount > 0: organización(es) exist but none are validada yet. At N0 nobody
 *   reviews until evidence is submitted, so the CTA leads to /acreditacion.
 */
export default function PendingValidationPage() {
  const navigate = useNavigate();
  const { data: orgs } = useMisOrganizaciones();
  const orgCount = useAuthStore((s) => s.orgCount);
  const logout = useAuthStore((s) => s.logout);

  const hasNoOrg = orgCount === 0;
  const firstOrgName = orgs?.[0]?.nombre;

  return (
    <div
      style={{
        maxWidth: 560,
        margin: '80px auto',
        padding: '40px 32px',
        border: '1px solid var(--line)',
        borderRadius: 16,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <Text variant="h2" color="earth">Validación pendiente</Text>

      {hasNoOrg ? (
        <>
          <Text variant="body" color="ink-2">
            Tu cuenta fue creada correctamente, pero todavía no registraste tu organización.
            Completá ese paso para poder empezar a publicar necesidades.
          </Text>
          <Button variant="primary" onClick={() => navigate('/mis-organizaciones')}>
            Crear tu organización
          </Button>
        </>
      ) : (
        <>
          <Text variant="body" color="ink-2">
            {firstOrgName ? (
              <>Tu organización <strong>{firstOrgName}</strong> todavía no aparece en el mapa.</>
            ) : (
              <>Tu organización todavía no aparece en el mapa.</>
            )}{' '}
            Cargá la evidencia de N1 para que un administrador la revise.
          </Text>
          <Button variant="primary" onClick={() => navigate('/acreditacion')}>
            Cargar evidencia para N1
          </Button>
          <Button variant="secondary" onClick={() => navigate('/mis-organizaciones')}>
            Mis organizaciones
          </Button>
        </>
      )}

      <Button variant="ghost" onClick={() => { void logout(); }}>
        Cerrar sesión
      </Button>

      <Text variant="body-sm" color="ink-3">
        Si tenés dudas, escribinos a{' '}
        <a href="mailto:soporte@hornero.ar" style={{ color: 'var(--horn)' }}>
          soporte@hornero.ar
        </a>
        .
      </Text>
    </div>
  );
}
