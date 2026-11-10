import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Text } from './ui/Typography';
import { Button } from './ui/Button';
import { useAuthStore } from '../store/auth.store';

interface PendingValidationCardProps {
  /** Name of the organización still pending validation; null when the referente has none yet. */
  orgNombre: string | null;
  /** Standalone screens have no AppShell, so they need their own logout action. */
  showLogout?: boolean;
  style?: CSSProperties;
}

/**
 * "Validación pendiente" card for REFERENTE users without a validated organización.
 * Shared by the standalone /pending-validation screen and the in-shell pages
 * (/dashboard, /needs), which render it instead of their content so the
 * referente keeps the navbar and header.
 *
 * - orgNombre === null: the account exists but organización creation never
 *   succeeded; CTA resumes it at /mis-organizaciones.
 * - otherwise: the organización exists but is not validada yet. At N0 nobody
 *   reviews until evidence is submitted, so the CTA leads to /acreditacion.
 */
export function PendingValidationCard({ orgNombre, showLogout = false, style }: PendingValidationCardProps) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  return (
    <div
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '40px 32px',
        border: '1px solid var(--line)',
        borderRadius: 16,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        backgroundColor: 'var(--card)',
        ...style,
      }}
    >
      <Text variant="h2" color="earth">Validación pendiente</Text>

      {orgNombre === null ? (
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
            {orgNombre ? (
              <>Tu organización <strong>{orgNombre}</strong> todavía no aparece en el mapa.</>
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

      {showLogout && (
        <Button variant="ghost" onClick={() => { void logout(); }}>
          Cerrar sesión
        </Button>
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
