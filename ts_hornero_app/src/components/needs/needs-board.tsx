'use client';

import { useState } from 'react';
import { Calendar } from 'iconsax-reactjs';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { Avatar } from '@/components/ui/avatar';
import { DonateButton } from '@/components/donaciones/donate-button';
import { EmptyState } from '@/components/ui/empty-state';
import { OrgCardSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { mapPrioridad, type NecesidadResponse } from '@/lib/api/donaciones.server';

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  medium: 'Media',
  normal: 'Normal',
};

const URGENCY_OPTIONS = ['Todas', 'Urgente', 'Media', 'Normal'];

const ESTADO_VARIANT: Record<string, 'ok' | 'warn' | 'ghost' | 'bad'> = {
  ABIERTA: 'ok',
  EN_PROGRESO: 'warn',
  CUMPLIDA: 'ghost',
  VENCIDA: 'bad',
};

interface NeedCardProps {
  n: NecesidadResponse;
  orgName: string;
}

function NeedCard({ n, orgName }: NeedCardProps) {
  const priority = mapPrioridad(n.prioridad);
  const estadoVariant = ESTADO_VARIANT[n.estado] ?? 'ghost';
  const fechaLabel = n.fechaVencimiento
    ? new Date(n.fechaVencimiento).toLocaleDateString('es-AR')
    : null;

  return (
    <Card
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        <DonateButton
          necesidadId={n.id}
          necesidadDescripcion={n.descripcion}
          orgNombre={orgName}
          size="sm"
        />
      </div>
    </Card>
  );
}

export interface NeedsBoardProps {
  necesidades: NecesidadResponse[];
  isLoading?: boolean;
  orgMap?: Map<number, string>;
  onCreateNew?: () => void;
}

export function NeedsBoard({ necesidades, isLoading = false, orgMap, onCreateNew }: NeedsBoardProps) {
  const [selectedUrgency, setSelectedUrgency] = useState('Todas');

  const filtered = selectedUrgency === 'Todas'
    ? necesidades
    : necesidades.filter((n) => {
        const p = mapPrioridad(n.prioridad);
        return PRIORITY_LABEL[p] === selectedUrgency;
      });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }, (_, i) => <OrgCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div>
      {/* urgency filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        <Text
          as="span"
          variant="caption"
          color="ink-3"
          style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}
        >
          Urgencia
        </Text>
        {URGENCY_OPTIONS.map((o) => (
          <span
            key={o}
            onClick={() => setSelectedUrgency(o)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              cursor: 'pointer',
              background: o === selectedUrgency ? 'var(--earth)' : 'var(--card)',
              boxShadow: o === selectedUrgency ? 'none' : 'var(--sh-1)',
            }}
          >
            <Text variant="label" as="span" style={{ color: o === selectedUrgency ? '#fff' : 'var(--ink-2)' }}>{o}</Text>
          </span>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState variant="no-necesidades" onCta={onCreateNew} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((n) => (
            <NeedCard
              key={n.id}
              n={n}
              orgName={orgMap?.get(n.organizacionId) ?? 'Organización'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
