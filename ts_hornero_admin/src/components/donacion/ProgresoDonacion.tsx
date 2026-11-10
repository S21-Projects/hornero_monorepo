import { Text } from '../ui/Typography';
import { FaseDonacion, type FaseDonacion as FaseDonacionType } from '../../types/domain';

interface Paso {
  label: string;
}

const PASOS: Paso[] = [
  { label: 'Ofrecida' },
  { label: 'Asignación' },
  { label: 'En camino' },
  { label: 'Entregada' },
];

/**
 * Maps every `FaseDonacion` value (design AD-4) onto its visual step index in the shared 4-step
 * strip (Ofrecida → Asignación → En camino → Entregada). `EN_FONDO` has no current step yet — the
 * donación is still waiting in the pool for a ronda.
 */
function pasoActual(fase: FaseDonacionType): number | null {
  switch (fase) {
    case FaseDonacion.EN_FONDO:
      return null;
    case FaseDonacion.OFRECIDA:
      return 0;
    case FaseDonacion.ASIGNADA:
    case FaseDonacion.ACEPTADA:
      return 1;
    case FaseDonacion.EN_CAMINO:
    case FaseDonacion.CONFIRMANDO:
      return 2;
    case FaseDonacion.ENTREGADA:
      return 3;
    case FaseDonacion.RECHAZADA:
    case FaseDonacion.CANCELADA:
      return null;
    default:
      return null;
  }
}

const TERMINAL_LABEL: Partial<Record<FaseDonacionType, string>> = {
  [FaseDonacion.RECHAZADA]: 'Rechazada',
  [FaseDonacion.CANCELADA]: 'Cancelada',
};

interface ProgresoDonacionProps {
  fase: FaseDonacionType;
}

/**
 * Presentational progress strip (spec `ronda-asignacion` / design AD-4): Ofrecida → Asignación →
 * En camino → Entregada, derived purely from the MS-computed `fase` — the SPA never re-derives
 * phase logic. A `FONDO_COMUN` donación still `EN_FONDO` shows an explicit waiting message
 * instead of a misleading "step 0". `RECHAZADA`/`CANCELADA` render a terminal banner instead.
 */
export function ProgresoDonacion({ fase }: ProgresoDonacionProps) {
  const terminal = TERMINAL_LABEL[fase];
  const actual = pasoActual(fase);

  return (
    <div>
      <ol
        style={{
          display: 'flex',
          gap: 12,
          listStyle: 'none',
          margin: 0,
          padding: 0,
          marginBottom: terminal || fase === FaseDonacion.EN_FONDO ? 8 : 0,
        }}
      >
        {PASOS.map((paso, i) => {
          const isCurrent = i === actual;
          const isDone = actual != null && i < actual;
          return (
            <li key={paso.label} style={{ flex: 1, textAlign: 'center' }}>
              <Text
                variant="label"
                color={isCurrent || isDone ? 'earth' : 'ink-3'}
                as="span"
                aria-current={isCurrent ? 'step' : undefined}
              >
                {paso.label}
              </Text>
            </li>
          );
        })}
      </ol>

      {fase === FaseDonacion.EN_FONDO && (
        <Text variant="body-sm" color="ink-2" as="p">
          En espera de asignación
        </Text>
      )}

      {terminal && (
        <Text variant="body-sm" color="urgent" as="p">
          {terminal}
        </Text>
      )}
    </div>
  );
}
