'use client';

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
import { useMisDonaciones } from '@/lib/hooks/useMisDonaciones';
import { useEliminarDonacion } from '@/lib/hooks/useEliminarDonacion';
import { useNecesidades } from '@/lib/hooks/useNecesidades';
import { useValidatedOrganizaciones } from '@/lib/hooks/useValidatedOrganizaciones';
import {
  ESTADO_DONACION_LABELS,
  ESTADO_DONACION_PILL,
  type DonacionResponse,
} from '@/lib/api/donaciones.server';

function fmtDate(value?: string): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('es-AR');
}

interface DonacionCardProps {
  d: DonacionResponse;
  necesidadDescripcion?: string;
  orgNombre?: string;
}

function DonacionCard({ d, necesidadDescripcion, orgNombre }: DonacionCardProps) {
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
          {orgNombre ?? 'Organización'}
        </Text>
        <Text variant="h3" as="h3">{necesidadDescripcion ?? `Necesidad #${d.necesidadId}`}</Text>
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
  const { data: donaciones, isPending, isError, refetch } = useMisDonaciones();
  const { data: necesidades } = useNecesidades();
  const { data: orgs } = useValidatedOrganizaciones();

  const necesidadMap = new Map(necesidades?.map((n) => [n.id, n.descripcion]) ?? []);
  const orgMap = new Map(orgs?.map((o) => [o.id, o.nombre]) ?? []);
  const count = donaciones?.length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar active="Mis donaciones" />
      <div className="flex-1 overflow-auto px-4 py-7 sm:px-10">
        <div style={{ marginBottom: 22 }}>
          <Text variant="h1">Mis donaciones</Text>
          <Text variant="body" color="ink-2" style={{ marginTop: 5 }}>
            {isPending
              ? 'Cargando...'
              : `${count} ${count === 1 ? 'donación registrada' : 'donaciones registradas'}`}
          </Text>
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
        ) : count === 0 ? (
          <EmptyState variant="no-donaciones" onCta={() => router.push('/donaciones')} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {donaciones!.map((d) => (
              <DonacionCard
                key={d.id}
                d={d}
                necesidadDescripcion={necesidadMap.get(d.necesidadId)}
                orgNombre={orgMap.get(d.organizacionId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
