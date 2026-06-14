'use client';

import { useState } from 'react';
import { Heart, Calendar } from 'iconsax-reactjs';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { OrgCardSkeleton } from '@/components/ui/skeleton';
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--ink-2)',
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 5,
          }}
        >
          <Avatar name={orgName} size={26} />
          {orgName}
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 900 }}>{n.descripcion}</h3>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        {fechaLabel ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: priority === 'urgent' ? 'var(--urgent)' : 'var(--ink-3)',
            }}
          >
            <Calendar size={15} /> {fechaLabel}
          </span>
        ) : (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)' }}>
            Sin vencimiento
          </span>
        )}
        <Button variant="primary" size="sm" style={{ gap: 6 }}>
          <Heart size={15} color="#fff" /> Donar
        </Button>
      </div>
    </Card>
  );
}

export interface NeedsBoardProps {
  necesidades: NecesidadResponse[];
  isLoading?: boolean;
  orgMap?: Map<number, string>;
}

export function NeedsBoard({ necesidades, isLoading = false, orgMap }: NeedsBoardProps) {
  const [selectedUrgency, setSelectedUrgency] = useState('Todas');

  const filtered = selectedUrgency === 'Todas'
    ? necesidades
    : necesidades.filter((n) => {
        const p = mapPrioridad(n.prioridad);
        return PRIORITY_LABEL[p] === selectedUrgency;
      });

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {Array.from({ length: 6 }, (_, i) => <OrgCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div>
      {/* urgency filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '.04em',
          }}
        >
          Urgencia
        </span>
        {URGENCY_OPTIONS.map((o) => (
          <span
            key={o}
            onClick={() => setSelectedUrgency(o)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              background: o === selectedUrgency ? 'var(--earth)' : 'var(--card)',
              color: o === selectedUrgency ? '#fff' : 'var(--ink-2)',
              boxShadow: o === selectedUrgency ? 'none' : 'var(--sh-1)',
            }}
          >
            {o}
          </span>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState variant="no-donaciones" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
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
