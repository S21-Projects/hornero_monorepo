import { Text } from '../ui/Typography';
import { FaseDonacion, type FaseDonacion as FaseDonacionType } from '../../types/domain';
import { PASOS_DONACION, pasoActual } from '../../lib/donacion-progreso';
import { formatFecha } from '../../lib/format';

const TERMINAL_LABEL: Partial<Record<FaseDonacionType, string>> = {
  [FaseDonacion.RECHAZADA]: 'Rechazada',
  [FaseDonacion.CANCELADA]: 'Cancelada',
};

/** Real dates known for each step (ISO `YYYY-MM-DD`); a missing key renders no date. */
export interface FechasProgreso {
  ofrecida?: string;
  asignacion?: string;
  enCamino?: string;
  entregada?: string;
}

const FECHA_KEYS = ['ofrecida', 'asignacion', 'enCamino', 'entregada'] as const;

interface ProgresoDonacionProps {
  fase: FaseDonacionType;
  fechas?: FechasProgreso;
}

/**
 * Presentational progress strip (spec `ronda-asignacion` / design AD-4): Ofrecida → Asignación →
 * En camino → Entregada, derived purely from the MS-computed `fase` — the SPA never re-derives
 * phase logic. A `FONDO_COMUN` donación still `EN_FONDO` shows an explicit waiting message
 * instead of a misleading "step 0". `RECHAZADA`/`CANCELADA` render a terminal banner instead.
 * Dates under a step are shown only when the caller has real data for it.
 */
export function ProgresoDonacion({ fase, fechas }: ProgresoDonacionProps) {
  const terminal = TERMINAL_LABEL[fase];
  const actual = pasoActual(fase);

  return (
    <div>
      <ol className="progress-steps">
        {PASOS_DONACION.map((label, i) => {
          const isCurrent = i === actual;
          const isDone = actual != null && i < actual;
          const fecha = fechas?.[FECHA_KEYS[i]];
          const modifier = isCurrent ? ' progress-steps__step--current' : isDone ? ' progress-steps__step--done' : '';
          return (
            <li key={label} className={`progress-steps__step${modifier}`}>
              <span className="progress-steps__dot" aria-hidden="true" />
              <Text
                variant="label"
                color={isCurrent || isDone ? 'earth' : 'ink-3'}
                as="span"
                aria-current={isCurrent ? 'step' : undefined}
              >
                {label}
              </Text>
              {fecha && (
                <Text variant="micro" color="ink-3" as="span" className="progress-steps__date">
                  {formatFecha(fecha)}
                </Text>
              )}
            </li>
          );
        })}
      </ol>

      {fase === FaseDonacion.EN_FONDO && (
        <Text variant="body-sm" color="ink-2" as="p" style={{ marginTop: 8 }}>
          En espera de asignación
        </Text>
      )}

      {terminal && (
        <Text variant="body-sm" color="urgent" as="p" style={{ marginTop: 8 }}>
          {terminal}
        </Text>
      )}
    </div>
  );
}
