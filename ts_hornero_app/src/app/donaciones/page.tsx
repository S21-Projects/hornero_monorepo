'use client';

import { useState } from 'react';
import { Calendar } from 'iconsax-reactjs';
import { TopBar } from '@/components/ui/top-bar';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { OrgCardSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { Pager } from '@/components/ui/Pager';
import { useDonaciones } from '@/lib/hooks/useDonaciones';
import {
  ESTADO_DONACION_LABELS,
  ESTADO_DONACION_PILL,
  type DonacionResponse,
} from '@/lib/api/donaciones.server';

function fmtDate(value?: string): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('es-AR');
}

function DonacionRow({ d }: { d: DonacionResponse }) {
  const estadoVariant = ESTADO_DONACION_PILL[d.estado] ?? 'ghost';
  const estadoLabel = ESTADO_DONACION_LABELS[d.estado] ?? d.estado;
  const fechaOferta = fmtDate(d.fechaOferta);

  return (
    <Card style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Pill variant={estadoVariant} dot>{estadoLabel}</Pill>
          {fechaOferta && (
            <Text as="span" variant="caption" color="ink-3" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={13} /> {fechaOferta}
            </Text>
          )}
        </div>
        <Text as="div" variant="body-sm" color="ink-2">
          {d.donanteName} · {d.necesidadDescripcion || `Necesidad #${d.necesidadId}`}
        </Text>
        {d.organizacionNombre && (
          <Text variant="caption" color="ink-3" style={{ marginTop: 2 }}>{d.organizacionNombre}</Text>
        )}
        {d.observaciones && (
          <Text variant="caption" color="ink-3" style={{ marginTop: 4 }}>{d.observaciones}</Text>
        )}
      </div>
    </Card>
  );
}

export default function DonacionesPage() {
  const [page, setPage] = useState(0);
  const { data, isPending, isError, refetch } = useDonaciones(page, 20);
  const donaciones = data?.content ?? [];
  const count = data?.totalElements ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar active="Donaciones" />
      <div className="flex-1 overflow-auto px-4 py-7 sm:px-10">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 22,
          }}
        >
          <div>
            <Text variant="h1">Donaciones</Text>
            <Text variant="body" color="ink-2" style={{ marginTop: 5 }}>
              {isPending
                ? 'Cargando...'
                : `${count} ${count === 1 ? 'donación registrada' : 'donaciones registradas'}`}
            </Text>
          </div>
        </div>

        {isError ? (
          <ErrorState
            onRetry={() => refetch()}
            message="No pudimos cargar las donaciones. Intentá de nuevo."
          />
        ) : isPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 5 }, (_, i) => <OrgCardSkeleton key={i} />)}
          </div>
        ) : donaciones.length === 0 ? (
          <EmptyState variant="no-donaciones" />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {donaciones.map((d) => (
                <DonacionRow key={d.id} d={d} />
              ))}
            </div>
            {data && (
              <Pager
                page={page}
                totalPages={data.totalPages}
                totalElements={data.totalElements}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
