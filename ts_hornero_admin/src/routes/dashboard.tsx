import { Link } from 'react-router-dom';
import { AsyncSection } from '../components/AsyncSection';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Typography';
import { ChartCard } from '../components/panel/ChartCard';
import { ChartEmptyState } from '../components/panel/ChartEmptyState';
import { DashboardSkeleton } from '../components/panel/DashboardSkeleton';
import { MetricBarChart, MetricPieChart } from '../components/panel/MetricCharts';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useNecesidadesDeOrg } from '../lib/hooks/useNecesidadesDeOrg';
import { useDonacionesDeMiOrg } from '../lib/hooks/useDonacionesDeMiOrg';
import { useDecidirDonacion } from '../lib/hooks/useDecidirDonacion';
import { necesidadesPorEstado, donacionesPorEstado } from '../lib/metricas';
import { formatFecha } from '../lib/format';
import type { Donacion } from '../types/domain';

// A referente may generate/verify delivery codes while ACEPTADA, EN_CAMINO or
// PENDIENTE_CONFIRMACION, as long as they haven't already confirmed on the confirmation screen
// (spec `donacion-entrega-codigo`). Mirrors CONFIRMABLE_ESTADOS in routes/mis-donaciones.tsx
// (donante side).
const CONFIRMABLE_ESTADOS = new Set(['ACEPTADA', 'EN_CAMINO', 'PENDIENTE_CONFIRMACION']);

interface DonacionAccionableRowProps {
  donacion: Donacion;
}

/** One OFRECIDA donation with Aceptar/Rechazar actions for the referente. */
function DonacionAccionableRow({ donacion }: DonacionAccionableRowProps) {
  const decidir = useDecidirDonacion();
  const isMutatingThis = decidir.isPending && decidir.variables?.id === donacion.id;

  return (
    <Card as="article" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {donacion.donanteName && <Text variant="body">{donacion.donanteName}</Text>}
          {donacion.fechaOferta && (
            <Text variant="caption" color="ink-3">Ofrecida: {formatFecha(donacion.fechaOferta)}</Text>
          )}
          {donacion.observaciones && (
            <Text variant="caption" color="ink-3">{donacion.observaciones}</Text>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button
            type="button"
            variant="ok"
            size="sm"
            loading={isMutatingThis && decidir.variables?.estado === 'ACEPTADA'}
            disabled={decidir.isPending}
            onClick={() => decidir.mutate({ id: donacion.id, estado: 'ACEPTADA' })}
          >
            Aceptar
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={isMutatingThis && decidir.variables?.estado === 'RECHAZADA'}
            disabled={decidir.isPending}
            onClick={() => decidir.mutate({ id: donacion.id, estado: 'RECHAZADA' })}
          >
            Rechazar
          </Button>
        </div>
      </div>

      {decidir.isError && decidir.variables?.id === donacion.id && (
        <Text variant="micro" color="urgent">No se pudo actualizar la donación. Intentá de nuevo.</Text>
      )}
    </Card>
  );
}

interface DonacionEntregaRowProps {
  donacion: Donacion;
}

/** One ACEPTADA/EN_CAMINO/PENDIENTE_CONFIRMACION donation with a "Confirmar entrega" action for the referente. */
function DonacionEntregaRow({ donacion }: DonacionEntregaRowProps) {
  return (
    <Card as="article" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {donacion.donanteName && <Text variant="body">{donacion.donanteName}</Text>}
          {donacion.fechaOferta && (
            <Text variant="caption" color="ink-3">Ofrecida: {formatFecha(donacion.fechaOferta)}</Text>
          )}
          {donacion.observaciones && (
            <Text variant="caption" color="ink-3">{donacion.observaciones}</Text>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link to={`/donaciones/${donacion.id}/entrega`} style={{ textDecoration: 'none' }}>
            <Button type="button" variant="ok" size="sm">
              Confirmar entrega
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  // A referente can own several organizaciones (up to 3). The dashboard summary
  // currently shows an aggregate across every organización they own — a
  // per-organización breakdown is left for a future slice (see /mis-organizaciones
  // and /needs for per-org views).
  const organizaciones = useMisOrganizaciones();
  const orgs = organizaciones.data ?? [];
  const primaryOrg = orgs[0];
  // This chart is an aggregate/distribution view, not a browsable list, so a
  // `Pager` doesn't apply here. `/necesidades` defaults to a page size of 20 at
  // the MS; widen to 100 so the "por estado" breakdown reflects the real
  // distribution for orgs with up to 100 needs instead of silently truncating.
  // Same stopgap precedent as `useOrgNombre` (BACKLOG-02) and `admin.tsx`
  // (`deriveAdminSummary`, size:100). TODO [tech-debt] BACKLOG-04: replace with
  // a dedicated aggregation endpoint if an org can exceed 100 needs.
  const necesidades = useNecesidadesDeOrg(primaryOrg?.id, { size: 100 });
  const donaciones = useDonacionesDeMiOrg();

  const isLoading = organizaciones.isLoading || necesidades.isLoading || donaciones.isLoading;
  const isError = organizaciones.isError || necesidades.isError || donaciones.isError;

  const necesidadesContent = necesidades.data?.content ?? [];
  const hasNecesidades = necesidadesContent.length > 0;
  const hasDonaciones = (donaciones.data?.length ?? 0) > 0;

  const necesidadesData = necesidadesPorEstado(necesidadesContent);
  const donacionesData = donacionesPorEstado(donaciones.data ?? []);
  const donacionesAccionables = (donaciones.data ?? []).filter((d) => d.estado === 'OFRECIDA');
  const donacionesParaConfirmar = (donaciones.data ?? []).filter(
    (d) => CONFIRMABLE_ESTADOS.has(d.estado) && !d.confirmadaReferenteEn,
  );

  const heading =
    orgs.length > 1
      ? `Resumen de ${primaryOrg?.nombre ?? 'mi organización'} y otras ${orgs.length - 1}`
      : `Resumen de ${primaryOrg?.nombre ?? 'mi organización'}`;

  return (
    <AsyncSection isLoading={isLoading} isError={isError} isEmpty={false} loadingFallback={<DashboardSkeleton />}>
      <div>
        <Text variant="h1">{heading}</Text>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
            marginTop: 24,
          }}
        >
          <ChartCard title="Necesidades por estado" subtitle="Estado actual de las necesidades publicadas">
            {hasNecesidades ? (
              <MetricBarChart data={necesidadesData} />
            ) : (
              <ChartEmptyState message="Todavía no hay necesidades cargadas." />
            )}
          </ChartCard>
          <ChartCard title="Donaciones recibidas" subtitle="Estado de las donaciones recibidas por tu organización">
            {hasDonaciones ? (
              <MetricPieChart data={donacionesData} />
            ) : (
              <ChartEmptyState message="Todavía no hay donaciones recibidas." />
            )}
          </ChartCard>
        </div>

        {donacionesAccionables.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <Text variant="h3" style={{ marginBottom: 12 }}>Donaciones pendientes de decisión</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {donacionesAccionables.map((d) => (
                <DonacionAccionableRow key={d.id} donacion={d} />
              ))}
            </div>
          </div>
        )}

        {donacionesParaConfirmar.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <Text variant="h3" style={{ marginBottom: 12 }}>Donaciones para confirmar entrega</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {donacionesParaConfirmar.map((d) => (
                <DonacionEntregaRow key={d.id} donacion={d} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AsyncSection>
  );
}
