import { useState } from 'react';
import { Calendar } from 'iconsax-reactjs';
import { Card } from '../ui/card';
import { Pill } from '../ui/pill';
import { Avatar } from '../ui/avatar';
import { EmptyState } from '../ui/empty-state';
import { Text } from '../ui/typography';
import type { Necesidad, Org } from '../../lib/types';

const PUBLIC_SPA_URL = import.meta.env.PUBLIC_SPA_URL ?? '';

type NecesidadUIPriority = 'urgent' | 'medium' | 'normal';

const PRIORITY_LABEL: Record<NecesidadUIPriority, string> = {
  urgent: 'Urgente',
  medium: 'Media',
  normal: 'Normal',
};

const URGENCY_OPTIONS = ['Todas', 'Urgente', 'Media', 'Normal'];

// Plain lowercase unit labels (feature catalogo-articulos), mirrors admin SPA's
// `UNIDAD_ARTICULO` in lib/domain-ui.ts.
const UNIDAD_LABEL: Record<string, string> = {
  KG: 'kg',
  PAQUETE: 'paquete',
  LITRO: 'litro',
  UNIDAD: 'unidad',
};

const ESTADO_VARIANT: Record<string, 'ok' | 'warn' | 'ghost' | 'bad'> = {
  ABIERTA: 'ok',
  EN_PROGRESO: 'warn',
  CUMPLIDA: 'ghost',
  VENCIDA: 'bad',
};

function mapPrioridad(prioridad: string): NecesidadUIPriority {
  const map: Record<string, NecesidadUIPriority> = {
    URGENTE: 'urgent',
    MEDIA: 'medium',
    NORMAL: 'normal',
  };
  return map[prioridad] ?? 'normal';
}

interface NeedCardProps {
  n: Necesidad;
  orgName: string;
}

function NeedCard({ n, orgName }: NeedCardProps) {
  const priority = mapPrioridad(n.prioridad);
  const estadoVariant = ESTADO_VARIANT[n.estado] ?? 'ghost';
  const fechaLabel = n.fechaVencimiento
    ? new Date(n.fechaVencimiento).toLocaleDateString('es-AR')
    : null;

  return (
    <Card className="flex flex-col gap-3.5 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill variant={priority}>{PRIORITY_LABEL[priority]}</Pill>
          <Pill variant={estadoVariant}>{n.estado}</Pill>
        </div>
      </div>

      <div>
        <Text
          as="div"
          variant="label"
          color="ink-2"
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}
        >
          <Avatar name={orgName} size={26} />
          {orgName}
        </Text>
        <Text variant="h3" as="h3">{n.descripcion}</Text>
        {n.articulos && n.articulos.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 6 }}>
            {n.articulos.map((a) => (
              <Pill key={a.id} variant="ghost">
                {a.nombre} ({UNIDAD_LABEL[a.unidad] ?? a.unidad})
              </Pill>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        {fechaLabel ? (
          <Text
            as="span"
            variant="caption"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: priority === 'urgent' ? 'var(--urgent)' : 'var(--ink-3)',
            }}
          >
            <Calendar size={15} /> {fechaLabel}
          </Text>
        ) : (
          <Text as="span" variant="caption" color="ink-3">
            Sin vencimiento
          </Text>
        )}
        {/* DonateButton removed — public read-only view; CTA deep-links to authenticated SPA */}
        <a
          href={`${PUBLIC_SPA_URL}/donaciones`}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--sky)',
            textDecoration: 'none',
          }}
        >
          Donar →
        </a>
      </div>
    </Card>
  );
}

interface NeedsBoardProps {
  needs: Necesidad[];
  orgs: Org[];
}

export default function NeedsBoard({ needs, orgs }: NeedsBoardProps) {
  const [selectedUrgency, setSelectedUrgency] = useState('Todas');

  const orgMap = new Map(orgs.map((o) => [o.id, o.nombre]));

  const filtered = selectedUrgency === 'Todas'
    ? needs
    : needs.filter((n) => {
        const p = mapPrioridad(n.prioridad);
        return PRIORITY_LABEL[p] === selectedUrgency;
      });

  return (
    <div>
      {/* urgency filter */}
      <div className="mb-5 flex flex-wrap items-center gap-2 sm:mb-[22px]">
        <Text
          as="span"
          variant="caption"
          color="ink-3"
          style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}
        >
          Urgencia
        </Text>
        {URGENCY_OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setSelectedUrgency(o)}
            className="cursor-pointer border-0 bg-transparent p-0"
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              background: o === selectedUrgency ? 'var(--earth)' : 'var(--card)',
              boxShadow: o === selectedUrgency ? 'none' : 'var(--sh-1)',
            }}
          >
            <Text variant="label" as="span" style={{ color: o === selectedUrgency ? '#fff' : 'var(--ink-2)' }}>{o}</Text>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState variant="no-necesidades" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((n) => (
            <NeedCard
              key={n.id}
              n={n}
              orgName={orgMap.get(n.organizacionId) ?? 'Organización'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
