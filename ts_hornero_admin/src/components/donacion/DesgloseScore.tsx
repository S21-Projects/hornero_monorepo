import { Badge } from '../Badge';
import { Card } from '../ui/Card';
import { Text } from '../ui/Typography';
import { formatDecimal } from '../../lib/format';
import { nivelCriterio, type NivelCriterio } from '../../lib/score-nivel';
import type { BadgeTone } from '../../lib/domain-ui';
import type { AsignacionHistorial } from '../../types/domain';

/**
 * Default normalized weights the worker applied pre-6a (`go_algorithms_worker/internal/assign/
 * scoring.go` `PesosDefault`) — fallback only for rows whose ronda never recorded a weight
 * snapshot (pre-AD-9 data, task 5f.15). Every other row uses the weights the ronda actually
 * applied (`AsignacionHistorial.peso*`), so "term × weight" no longer drifts once 6a renormalizes
 * the weights or a ronda uses overrides.
 */
const PESO_DEFAULT = {
  deficit: 0.35,
  urgencia: 0.3,
  proximidad: 0.2,
  espera: 0.15,
  cumplimiento: 0.15,
} as const;

const NIVEL_TONE: Record<NivelCriterio, BadgeTone> = { Baja: 'neutral', Media: 'sky', Alta: 'ok' };

/** One plain-language sentence per `deficitFuente` value (MS `Asignacion.deficitFuente`). */
const FUENTE_DEFICIT: Record<string, string> = {
  PROVISTO: 'La necesidad de la zona se calculó con la cobertura que ya tiene la organización.',
  RADIO: 'La necesidad de la zona se calculó con los datos censales de su radio.',
  CERCANO: 'No había datos de su radio exacto: la necesidad de la zona se estimó con un radio cercano.',
  NEUTRAL: 'Sin datos censales para esta zona: la necesidad se tomó como promedio.',
};

interface Criterio {
  key: string;
  /** Donor-facing name. */
  titulo: string;
  valor: number;
  peso: number;
}

/** Presentational bar — the level is always rendered as text, never color-only. */
function BarraCriterio({ titulo, valor }: Pick<Criterio, 'titulo' | 'valor'>) {
  const nivel = nivelCriterio(valor);
  const pct = Math.max(0, Math.min(1, valor)) * 100;

  return (
    <div className="score-bar">
      <div className="score-bar__head">
        <Text variant="label" color="ink" as="span">{titulo}</Text>
        <Badge tone={NIVEL_TONE[nivel]} label={nivel} />
      </div>
      <div role="img" aria-label={`${titulo}: ${nivel}`} className="score-bar__track">
        <div className="score-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface DesgloseScoreProps {
  asignacion: AsignacionHistorial;
}

function introduccion(criterios: Criterio[]): string {
  const top = [...criterios].sort((a, b) => b.valor * b.peso - a.valor * a.peso).slice(0, 2);
  const nombres = top.map((c) => c.titulo.toLowerCase());
  return `Esta organización se eligió sobre todo por ${nombres.join(' y ')}.`;
}

/**
 * "¿Por qué este destino?" card for the donor: criteria in plain language with a Baja/Media/Alta
 * level per bar, an intro naming the two that weighed most, a sentence about where the zone's
 * need came from, and the raw `term × weight` numbers tucked inside "Ver el cálculo". The 5th
 * criterion (`cumplimiento`) only appears once slice 6b starts populating it.
 */
export function DesgloseScore({ asignacion: a }: DesgloseScoreProps) {
  const criterios: Criterio[] = [
    { key: 'deficit', titulo: 'Necesidad de la zona', valor: a.terminoDeficit, peso: a.pesoDeficit ?? PESO_DEFAULT.deficit },
    { key: 'urgencia', titulo: 'Urgencia del pedido', valor: a.terminoUrgencia, peso: a.pesoUrgencia ?? PESO_DEFAULT.urgencia },
    { key: 'proximidad', titulo: 'Cercanía', valor: a.terminoProximidad, peso: a.pesoProximidad ?? PESO_DEFAULT.proximidad },
    { key: 'espera', titulo: 'Tiempo sin recibir', valor: a.terminoEspera, peso: a.pesoEspera ?? PESO_DEFAULT.espera },
  ];

  if (a.terminoCumplimiento != null) {
    criterios.push({
      key: 'cumplimiento',
      titulo: 'Cumplimiento',
      valor: a.terminoCumplimiento,
      peso: a.pesoCumplimiento ?? PESO_DEFAULT.cumplimiento,
    });
  }

  const fuente = FUENTE_DEFICIT[a.deficitFuente];

  return (
    <Card as="section" className="card-pad">
      <Text variant="h3" style={{ marginBottom: 4 }}>¿Por qué este destino?</Text>
      <Text variant="body-sm" color="ink-2" as="p" style={{ marginBottom: 16 }}>
        {introduccion(criterios)}
      </Text>

      {criterios.map(({ key, titulo, valor }) => (
        <BarraCriterio key={key} titulo={titulo} valor={valor} />
      ))}

      {fuente && (
        <Text variant="caption" color="ink-3" as="p" style={{ marginTop: 12 }}>
          {fuente}
        </Text>
      )}

      <details className="score-details">
        <summary>Ver el cálculo</summary>
        <ul className="score-details__list">
          {criterios.map((c) => (
            <li key={c.key}>
              <Text variant="caption" as="span">{c.titulo}</Text>
              <Text variant="caption" as="span" data-testid="desglose-valor">
                {formatDecimal(c.valor)} × {formatDecimal(c.peso)} = {formatDecimal(c.valor * c.peso)}
              </Text>
            </li>
          ))}
        </ul>
        <div className="score-details__total">
          <Text variant="label" as="span">Puntaje total</Text>
          <Text variant="label" as="span">{formatDecimal(a.score)}</Text>
        </div>
      </details>
    </Card>
  );
}
