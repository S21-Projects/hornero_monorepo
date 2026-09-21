import { Badge } from '../Badge';
import type { BadgeTone } from '../../lib/domain-ui';
import type { NivelAcreditacion } from '../../types/domain';

const NIVEL_LABELS: Record<NivelAcreditacion, string> = {
  N0: 'Registrada',
  N1: 'Identificada',
  N2: 'Operativa',
  N3: 'Acreditada',
};

const NIVEL_TONES: Record<NivelAcreditacion, BadgeTone> = {
  N0: 'neutral',
  N1: 'sky',
  N2: 'sky',
  N3: 'ok',
};

interface NivelBadgeProps {
  nivel: NivelAcreditacion;
}

/** Reuses the shared `Badge` — one distinguishable tone/label per N0-N3 rung (spec's ladder table). */
export function NivelBadge({ nivel }: NivelBadgeProps) {
  return <Badge tone={NIVEL_TONES[nivel]} label={NIVEL_LABELS[nivel]} />;
}
