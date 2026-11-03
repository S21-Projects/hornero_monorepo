import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AsyncSection } from '../components/AsyncSection';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pager } from '../components/ui/Pager';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { ChartCard } from '../components/panel/ChartCard';
import { ChartEmptyState } from '../components/panel/ChartEmptyState';
import { DashboardSkeleton } from '../components/panel/DashboardSkeleton';
import { MetricBarChart, MetricPieChart } from '../components/panel/MetricCharts';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useNecesidadesDeOrg } from '../lib/hooks/useNecesidadesDeOrg';
import { useDonacionesDeMiOrg } from '../lib/hooks/useDonacionesDeMiOrg';
import { useDecidirDonacion } from '../lib/hooks/useDecidirDonacion';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { necesidadesPorEstado, donacionesPorEstado } from '../lib/metricas';
import { formatFecha, formatLineas } from '../lib/format';
import { Badge } from '../components/Badge';
import { PendingValidationCard } from '../components/PendingValidationCard';
import { MODALIDAD_DONACION } from '../lib/domain-ui';
import { ModalidadDonacion } from '../types/domain';
import type { Donacion } from '../types/domain';

// A referente may generate/verify delivery codes while ACEPTADA, EN_CAMINO or
// PENDIENTE_CONFIRMACION, as long as they haven't already confirmed on the confirmation screen
// (spec `donacion-entrega-codigo`). Mirrors CONFIRMABLE_ESTADOS in routes/mis-donaciones.tsx
// (donante side).
const CONFIRMABLE_ESTADOS = new Set(['ACEPTADA', 'EN_CAMINO', 'PENDIENTE_CONFIRMACION']);

/** Donations are listed newest first, one page at a time (the MS caps a page at 100). */
const DONACIONES_PAGE_SIZE = 20;

// The action lists are filtered server-side by estado (and fetched at the MS page cap) so an
// actionable donation is never hidden on a later page of the general history.
const ACCIONABLES_PAGE_SIZE = 100;
const ESTADOS_PENDIENTES_DECISION = ['OFRECIDA'];
const ESTADOS_PARA_CONFIRMAR = [...CONFIRMABLE_ESTADOS];

interface TruncatedNoteProps {
  page?: { content: unknown[]; totalElements: number };
}

/** "Showing N of M" hint for an action list that exceeds the page cap. */
function TruncatedNote({ page }: TruncatedNoteProps) {
  if (!page || page.totalElements <= page.content.length) return null;
  return (
    <Text variant="caption" color="ink-3" style={{ marginTop: 8 }}>
      Mostrando {page.content.length} de {page.totalElements}. Resolvé estas para ver las siguientes.
    </Text>
  );
}

interface DonacionAccionableRowProps {
  donacion: Donacion;
}

/** One OFRECIDA donation with Aceptar/Rechazar actions for the referente. */
function DonacionAccionableRow({ donacion }: DonacionAccionableRowProps) {
  const decidir = useDecidirDonacion();
  const isMutatingThis = decidir.isPending && decidir.variables?.id === donacion.id;
  const esFondoComun = donacion.modalidad === ModalidadDonacion.FONDO_COMUN;
  const modalidadCfg = esFondoComun ? MODALIDAD_DONACION[donacion.modalidad as string] : undefined;

  return (
    <Card as="article" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {modalidadCfg && (
            <div style={{ marginBottom: 2 }}>
              <Badge tone={modalidadCfg.tone} label={modalidadCfg.label} />
            </div>
          )}
          {donacion.donanteName && <Text variant="body">{donacion.donanteName}</Text>}
          {donacion.fechaOferta && (
            <Text variant="caption" color="ink-3">Ofrecida: {formatFecha(donacion.fechaOferta)}</Text>
          )}
          {donacion.lineas && donacion.lineas.length > 0 && (
            <Text variant="caption" color="ink-3">{formatLineas(donacion.lineas)}</Text>
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

      {esFondoComun && (
        <Text variant="micro" color="ink-3">
          Si rechazás esta oferta, vuelve al fondo común y no se le volverá a ofrecer a esta organización.
        </Text>
      )}

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
          {donacion.lineas && donacion.lineas.length > 0 && (
            <Text variant="caption" color="ink-3">{formatLineas(donacion.lineas)}</Text>
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

const DASHBOARD_DESCRIPTION = 'Seguí el estado de tus necesidades y donaciones en un solo lugar.';

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
  // TODO [tech-debt] BACKLOG-04: replace with a dedicated aggregation endpoint
  // if an org can exceed 100 needs.
  const necesidades = useNecesidadesDeOrg(primaryOrg?.id, { size: 100 });
  const [donacionesPage, setDonacionesPage] = useState(0);
  const donaciones = useDonacionesDeMiOrg({ page: donacionesPage, size: DONACIONES_PAGE_SIZE });
  usePageClamp(donacionesPage, setDonacionesPage, donaciones.data?.totalPages);
  const pendientes = useDonacionesDeMiOrg({
    page: 0,
    size: ACCIONABLES_PAGE_SIZE,
    estado: ESTADOS_PENDIENTES_DECISION,
  });
  const paraConfirmar = useDonacionesDeMiOrg({
    page: 0,
    size: ACCIONABLES_PAGE_SIZE,
    estado: ESTADOS_PARA_CONFIRMAR,
  });

  const isLoading =
    organizaciones.isLoading ||
    necesidades.isLoading ||
    donaciones.isLoading ||
    pendientes.isLoading ||
    paraConfirmar.isLoading;
  const isError =
    organizaciones.isError ||
    necesidades.isError ||
    donaciones.isError ||
    pendientes.isError ||
    paraConfirmar.isError;

  const necesidadesContent = necesidades.data?.content ?? [];
  const hasNecesidades = necesidadesContent.length > 0;
  const donacionesContent = donaciones.data?.content ?? [];
  const hasDonaciones = donacionesContent.length > 0;
  const donacionesPaginadas = (donaciones.data?.totalPages ?? 0) > 1;

  const necesidadesData = necesidadesPorEstado(necesidadesContent);
  const donacionesData = donacionesPorEstado(donacionesContent);
  // The estado filter is applied by the MS; the client re-checks it and drops the donations the
  // referente already confirmed (not a filterable column).
  const donacionesAccionables = (pendientes.data?.content ?? []).filter((d) => d.estado === 'OFRECIDA');
  const donacionesParaConfirmar = (paraConfirmar.data?.content ?? []).filter(
    (d) => CONFIRMABLE_ESTADOS.has(d.estado) && !d.confirmadaReferenteEn,
  );

  const heading =
    orgs.length > 1
      ? `Resumen de ${primaryOrg?.nombre ?? 'mi organización'} y otras ${orgs.length - 1}`
      : `Resumen de ${primaryOrg?.nombre ?? 'mi organización'}`;

  // The route is not gated on validation: a referente without any validated
  // organización keeps the AppShell and sees the pending card instead of the summary.
  if (organizaciones.isSuccess && !orgs.some((o) => o.validada)) {
    return (
      <div>
        <PageHeader title={heading} description={DASHBOARD_DESCRIPTION} />
        <PendingValidationCard orgNombre={primaryOrg ? primaryOrg.nombre : null} />
      </div>
    );
  }

  return (
    <AsyncSection isLoading={isLoading} isError={isError} isEmpty={false} loadingFallback={<DashboardSkeleton />}>
      <div>
        <PageHeader
          title={heading}
          description={DASHBOARD_DESCRIPTION}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          <ChartCard title="Necesidades por estado" subtitle="Estado actual de las necesidades publicadas">
            {hasNecesidades ? (
              <MetricBarChart data={necesidadesData} />
            ) : (
              <ChartEmptyState message="Todavía no hay necesidades cargadas." />
            )}
          </ChartCard>
          <ChartCard
            title="Donaciones recibidas"
            subtitle={
              donacionesPaginadas
                ? `Estado de las donaciones de esta página (${donaciones.data?.totalElements ?? 0} en total)`
                : 'Estado de las donaciones recibidas por tu organización'
            }
          >
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
            <TruncatedNote page={pendientes.data} />
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
            <TruncatedNote page={paraConfirmar.data} />
          </div>
        )}

        {donaciones.data && (
          <Pager page={donaciones.data} onPageChange={setDonacionesPage} disabled={donaciones.isFetching} />
        )}
      </div>
    </AsyncSection>
  );
}
