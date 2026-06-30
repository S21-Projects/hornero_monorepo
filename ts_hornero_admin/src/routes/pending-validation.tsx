import { Text } from '../components/ui/Typography';
import { useMiOrganizacion } from '../lib/hooks/useMiOrganizacion';

/**
 * Shown to REFERENTE users whose organization has not been validated yet.
 * Re-uses the cached useMiOrganizacion result from AuthInitializer (no extra request).
 */
export default function PendingValidationPage() {
  const { data: org } = useMiOrganizacion();

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

      {org?.nombre ? (
        <Text variant="body" color="ink-2">
          Tu organización <strong>{org.nombre}</strong> está siendo revisada por el equipo de
          Hornero. Te notificaremos cuando sea aprobada.
        </Text>
      ) : (
        <Text variant="body" color="ink-2">
          Tu organización está siendo revisada por el equipo de Hornero. Te notificaremos cuando
          sea aprobada.
        </Text>
      )}

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
