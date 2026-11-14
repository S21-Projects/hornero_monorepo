import { PRIORIDAD, FALLBACK_BADGE } from '../../lib/domain-ui';
import { formatFecha } from '../../lib/format';
import { Badge } from '../Badge';
import { Card } from '../ui/Card';
import { Text } from '../ui/Typography';
import type { Necesidad } from '../../types/domain';

interface NecesidadPickCardProps {
  necesidad: Necesidad;
  checked: boolean;
  onSelect: (necesidad: Necesidad) => void;
}

/** Selectable necesidad card for the direct-donation wizard (native radio inside a label). */
export function NecesidadPickCard({ necesidad: n, checked, onSelect }: NecesidadPickCardProps) {
  const prioridad = PRIORIDAD[n.prioridad] ?? FALLBACK_BADGE;
  const pide = n.articulos?.map((a) => a.nombre).join(', ');
  return (
    <label>
      <input
        className="pick-card__input"
        type="radio"
        name="necesidad"
        value={n.id}
        checked={checked}
        onChange={() => { onSelect(n); }}
      />
      <Card className={`list-card pick-card${checked ? ' pick-card--selected' : ''}`}>
        <div className="list-card__body">
          <div className="list-card__badges">
            <Badge tone={prioridad.tone} label={prioridad.label} />
            {n.fechaVencimiento && (
              <Text variant="caption" color="ink-3">Vence: {formatFecha(n.fechaVencimiento)}</Text>
            )}
          </div>
          <Text variant="title">{n.descripcion}</Text>
          <Text variant="body-sm" color="ink-2">{n.organizacionNombre ?? 'Organización'}</Text>
          {pide && <Text variant="caption" color="ink-3">Pide: {pide}</Text>}
        </div>
      </Card>
    </label>
  );
}
