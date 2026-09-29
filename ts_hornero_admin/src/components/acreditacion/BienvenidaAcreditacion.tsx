import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import { Badge } from '../Badge';
import { useAcreditacion } from '../../lib/hooks/useAcreditacion';
import { NIVEL_LADDER } from '../../lib/acreditacion';

interface BienvenidaAcreditacionProps {
  organizacionId: number;
  organizacionNombre: string;
  /** Fired by the "Empezar con N1" CTA — navigation is the caller's concern. */
  onEmpezar: () => void;
  /** Fired by "Más tarde" — same, navigation stays with the caller. */
  onMasTarde: () => void;
}

/**
 * Presentational register step (3rd, referente-only): explains the N0..N3
 * accreditation ladder and highlights the organización's current level.
 * Current level comes from `useAcreditacion(organizacionId)` — the same
 * source `NivelBadge`/`acreditacion.tsx` use elsewhere, no client-side
 * re-derivation.
 */
export function BienvenidaAcreditacion({
  organizacionId,
  organizacionNombre,
  onEmpezar,
  onMasTarde,
}: BienvenidaAcreditacionProps) {
  const acreditacion = useAcreditacion(organizacionId);
  const nivelActual = acreditacion.data?.nivel;

  return (
    <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Text variant="h2" as="h1" color="earth" style={{ textAlign: 'center' }}>
        {organizacionNombre} ya está registrado(a)
      </Text>
      <Text as="p" variant="body-sm" color="ink-2" style={{ textAlign: 'center' }}>
        Tu nivel de acreditación crece con evidencia que un administrador revisa. Así es la
        escalera:
      </Text>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {NIVEL_LADDER.map((entry) => (
          <Card key={entry.nivel} style={{ padding: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <Text variant="title" color="earth">{entry.titulo}</Text>
              {nivelActual === entry.nivel && <Badge tone="ok" label="Nivel actual" />}
            </div>
            <Text as="p" variant="body-sm" color="ink-2">{entry.descripcion}</Text>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <Button type="button" variant="primary" block onClick={onEmpezar}>
          Empezar con N1
        </Button>
        <Button type="button" variant="secondary" block onClick={onMasTarde}>
          Más tarde
        </Button>
      </div>
    </div>
  );
}
