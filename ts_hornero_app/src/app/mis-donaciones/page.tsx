'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from 'iconsax-reactjs';
import { TopBar } from '@/components/ui/top-bar';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { OrgCardSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { Pager } from '@/components/ui/Pager';
import { useMisDonaciones } from '@/lib/hooks/useMisDonaciones';
import { useEliminarDonacion } from '@/lib/hooks/useEliminarDonacion';
import {
  ESTADO_DONACION_LABELS,
  ESTADO_DONACION_PILL,
  type DonacionResponse,
} from '@/lib/api/donaciones.server';

const PAGE_SIZE_OPTIONS = [10, 20, 25] as const;

function fmtDate(value?: string): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('es-AR');
}

function DonacionCard({ d }: { d: DonacionResponse }) {
  const { mutate: cancelar, isPending: cancelling } = useEliminarDonacion();
  const estadoVariant = ESTADO_DONACION_PILL[d.estado] ?? 'ghost';
  const estadoLabel = ESTADO_DONACION_LABELS[d.estado] ?? d.estado;
  const fechaOferta = fmtDate(d.fechaOferta);
  const fechaEntrega = fmtDate(d.fechaEntrega);

  return (
    <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Pill variant={estadoVariant} dot>{estadoLabel}</Pill>
        {fechaOferta && (
          <Text as="span" variant="caption" color="ink-3" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} /> {fechaOferta}
          </Text>
        )}
      </div>

      <div>
        <Text as="div" variant="label" color="ink-2" style={{ marginBottom: 5 }}>
          {d.organizacionNombre || 'Organización'}
        </Text>
        <Text variant="h3" as="h3">{d.necesidadDescripcion || `Necesidad #${d.necesidadId}`}</Text>
      </div>

      {d.observaciones && (
        <Text variant="body-sm" color="ink-2">{d.observaciones}</Text>
      )}

      {fechaEntrega && (
        <Text variant="caption" color="ink-3">Entregada el {fechaEntrega}</Text>
      )}

      {d.estado === 'OFRECIDA' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="danger"
            size="sm"
            loading={cancelling}
            onClick={() => cancelar(d.id)}
          >
            Cancelar donación
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function MisDonacionesPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const { data, isPending, isError, refetch } = useMisDonaciones(page, size);
  const donaciones = data?.content ?? [];
  const count = data?.totalElements ?? 0;

  function handleSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSize(Number(e.target.value));
    setPage(0);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar active="Mis donaciones" />
      <div className="flex-1 overflow-auto px-4 py-7 sm:px-10">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <Text variant="h1">Mis donaciones</Text>
            <Text variant="body" color="ink-2" style={{ marginTop: 5 }}>
              {isPending
                ? 'Cargando...'
                : `${count} ${count === 1 ? 'donación registrada' : 'donaciones registradas'}`}
            </Text>
          </div>
          <select
            value={size}
            onChange={handleSizeChange}
            aria-label="Donaciones por página"
            style={{ fontSize: 14, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }}
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt} por página</option>
            ))}
          </select>
        </div>

        {isError ? (
          <ErrorState
            onRetry={() => refetch()}
            message="No pudimos cargar tus donaciones. Intentá de nuevo."
          />
        ) : isPending ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }, (_, i) => <OrgCardSkeleton key={i} />)}
          </div>
        ) : donaciones.length === 0 ? (
          <EmptyState variant="no-donaciones" onCta={() => router.push('/donaciones')} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {donaciones.map((d) => (
                <DonacionCard key={d.id} d={d} />
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
