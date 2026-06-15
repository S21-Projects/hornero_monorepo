'use client';

import { Calendar, TickCircle, CloseCircle } from 'iconsax-reactjs';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { OrgCardSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import {
  mapPrioridad,
  ESTADO_DONACION_LABELS,
  ESTADO_DONACION_PILL,
  type NecesidadResponse,
  type DonacionResponse,
} from '@/lib/api/donaciones.server';
import { useActualizarEstadoDonacion } from '@/lib/hooks/useActualizarEstadoDonacion';

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  medium: 'Media',
  normal: 'Normal',
};

const ESTADO_NECESIDAD_VARIANT: Record<string, 'ok' | 'warn' | 'ghost' | 'bad'> = {
  ABIERTA: 'ok',
  EN_PROGRESO: 'warn',
  CUMPLIDA: 'ghost',
  VENCIDA: 'bad',
};

function DonacionRow({ d }: { d: DonacionResponse }) {
  const { mutate, isPending } = useActualizarEstadoDonacion();
  const isOfrecida = d.estado === 'OFRECIDA';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 0',
        borderBottom: '1px solid var(--line-soft)',
      }}
    >
      <Avatar name={d.donanteName} size={36} tintIndex={d.donanteName.length % 6} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text as="span" variant="body-sm">{d.donanteName}</Text>
          <Pill variant={ESTADO_DONACION_PILL[d.estado] ?? 'ghost'} dot>
            {ESTADO_DONACION_LABELS[d.estado] ?? d.estado}
          </Pill>
        </div>
        {d.observaciones && (
          <Text as="p" variant="label" color="ink-2" style={{ marginTop: 4 }}>
            {d.observaciones}
          </Text>
        )}

        {isOfrecida && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button
              variant="ok"
              size="sm"
              loading={isPending}
              onClick={() => mutate({ id: d.id, estado: 'ENTREGADA' })}
              style={{ gap: 6 }}
            >
              <TickCircle size={15} color="#fff" /> Confirmar recepción
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={isPending}
              onClick={() => mutate({ id: d.id, estado: 'CANCELADA' })}
              style={{ gap: 6 }}
            >
              <CloseCircle size={15} color="#fff" /> Rechazar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ManagedNeedCardProps {
  n: NecesidadResponse;
  donaciones: DonacionResponse[];
}

function ManagedNeedCard({ n, donaciones }: ManagedNeedCardProps) {
  const priority = mapPrioridad(n.prioridad);
  const estadoVariant = ESTADO_NECESIDAD_VARIANT[n.estado] ?? 'ghost';
  const pendientes = donaciones.filter((d) => d.estado === 'OFRECIDA').length;
  const fechaLabel = n.fechaVencimiento
    ? new Date(n.fechaVencimiento).toLocaleDateString('es-AR')
    : null;

  return (
    <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Pill variant={priority}>{PRIORITY_LABEL[priority]}</Pill>
        <Pill variant={estadoVariant}>{n.estado}</Pill>
      </div>

      <div>
        <Text variant="h3" as="h3">{n.descripcion}</Text>
        {fechaLabel && (
          <Text
            as="span"
            variant="caption"
            color="ink-3"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6 }}
          >
            <Calendar size={15} /> Vence {fechaLabel}
          </Text>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text as="h4" variant="title">Donaciones</Text>
          {pendientes > 0 && (
            <Pill variant="warn" dot>{pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'}</Pill>
          )}
        </div>
        {donaciones.length === 0 ? (
          <Text as="p" variant="label" color="ink-3" style={{ marginTop: 8 }}>
            Todavía no recibiste donaciones para esta necesidad.
          </Text>
        ) : (
          <div>
            {donaciones.map((d) => (
              <DonacionRow key={d.id} d={d} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export interface ManagedNeedsBoardProps {
  necesidades: NecesidadResponse[];
  donacionesPorNecesidad: Map<number, DonacionResponse[]>;
  isLoading?: boolean;
  onCreateNew?: () => void;
}

export function ManagedNeedsBoard({
  necesidades,
  donacionesPorNecesidad,
  isLoading = false,
  onCreateNew,
}: ManagedNeedsBoardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 4 }, (_, i) => <OrgCardSkeleton key={i} />)}
      </div>
    );
  }

  if (necesidades.length === 0) {
    return <EmptyState variant="no-necesidades" onCta={onCreateNew} />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {necesidades.map((n) => (
        <ManagedNeedCard
          key={n.id}
          n={n}
          donaciones={donacionesPorNecesidad.get(n.id) ?? []}
        />
      ))}
    </div>
  );
}
