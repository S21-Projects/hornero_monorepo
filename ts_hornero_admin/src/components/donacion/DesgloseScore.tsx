import { Card } from '../ui/Card';
import { Text } from '../ui/Typography';
import type { AsignacionHistorial } from '../../types/domain';

/**
 * Default normalized weights the worker applies pre-6a (`go_algorithms_worker/internal/assign/
 * scoring.go` `PesosDefault`) — used here only to render each criterion's contribution
 * (`term × weight`) per task 5f.2, since `AsignacionResponse` carries raw terms, not the ronda's
 * applied weights. Slice 6b adds the 5th (`cumplimiento`) weight once the MS starts sending it.
 */
const PESO_DEFAULT = {
  deficit: 0.35,
  urgencia: 0.3,
  proximidad: 0.2,
  espera: 0.15,
} as const;

interface Criterio {
  key: string;
  titulo: string;
  valor: number;
  peso: number;
}

/** Presentational text-value bar — accessible by design: the value is always rendered as text, never color-only. */
function BarraCriterio({ titulo, valor, peso }: Omit<Criterio, 'key'>) {
  const contribucion = valor * peso;
  const pct = Math.max(0, Math.min(1, valor)) * 100;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text variant="label" as="span">{titulo}</Text>
        <Text variant="caption" as="span" data-testid="desglose-valor">
          {valor.toFixed(2)} × {peso.toFixed(2)} = {contribucion.toFixed(2)}
        </Text>
      </div>
      <div
        role="img"
        aria-label={`${titulo}: ${valor.toFixed(2)}`}
        style={{ height: 6, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--horn)' }} />
      </div>
    </div>
  );
}

interface DesgloseScoreProps {
  asignacion: AsignacionHistorial;
}

/**
 * "¿Por qué este destino?" card (design's mockup for `/mis-donaciones/:id`): total score plus one
 * bar per criterion, each rendering `term × weight` as text (spec: accessible, not color-only).
 * The 5th criterion (`cumplimiento`) only appears once slice 6b starts populating it.
 */
export function DesgloseScore({ asignacion: a }: DesgloseScoreProps) {
  const criterios: Criterio[] = [
    { key: 'deficit', titulo: 'Déficit de cobertura', valor: a.terminoDeficit, peso: PESO_DEFAULT.deficit },
    { key: 'urgencia', titulo: 'Urgencia', valor: a.terminoUrgencia, peso: PESO_DEFAULT.urgencia },
    { key: 'proximidad', titulo: 'Proximidad', valor: a.terminoProximidad, peso: PESO_DEFAULT.proximidad },
    { key: 'espera', titulo: 'Tiempo de espera', valor: a.terminoEspera, peso: PESO_DEFAULT.espera },
  ];

  if (a.terminoCumplimiento != null) {
    criterios.push({
      key: 'cumplimiento',
      titulo: 'Cumplimiento histórico',
      valor: a.terminoCumplimiento,
      peso: 0.15,
    });
  }

  return (
    <Card as="section" style={{ padding: '20px 24px' }}>
      <Text variant="h3" style={{ marginBottom: 4 }}>¿Por qué este destino?</Text>
      <Text variant="body-sm" color="ink-2" style={{ marginBottom: 16, display: 'block' }}>
        El motor de asignación eligió esta organización combinando estos criterios.
      </Text>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text variant="label" as="span">Puntaje total</Text>
        <Text variant="label" as="span">{a.score.toFixed(2)}</Text>
      </div>

      {criterios.map(({ key, ...c }) => (
        <BarraCriterio key={key} {...c} />
      ))}

      <Text variant="micro" color="ink-3" style={{ marginTop: 12, display: 'block' }}>
        Fuente del déficit: {a.deficitFuente}
      </Text>
    </Card>
  );
}
