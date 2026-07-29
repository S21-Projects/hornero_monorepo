import { AsyncSection } from '../components/AsyncSection';
import { Text } from '../components/ui/Typography';
import { ChartCard } from '../components/panel/ChartCard';
import { ChartEmptyState } from '../components/panel/ChartEmptyState';
import { DashboardSkeleton } from '../components/panel/DashboardSkeleton';
import { MetricBarChart, MetricPieChart } from '../components/panel/MetricCharts';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useNecesidadesDeOrg } from '../lib/hooks/useNecesidadesDeOrg';
import { useDonacionesDeMiOrg } from '../lib/hooks/useDonacionesDeMiOrg';
import { necesidadesPorEstado, donacionesPorEstado } from '../lib/metricas';

export default function DashboardPage() {
  // A referente can own several organizaciones (up to 3). The dashboard summary
  // currently shows an aggregate across every organización they own — a
  // per-organización breakdown is left for a future slice (see /mis-organizaciones
  // and /needs for per-org views).
  const organizaciones = useMisOrganizaciones();
  const orgs = organizaciones.data ?? [];
  const primaryOrg = orgs[0];
  const necesidades = useNecesidadesDeOrg(primaryOrg?.id);
  const donaciones = useDonacionesDeMiOrg();

  const isLoading = organizaciones.isLoading || necesidades.isLoading || donaciones.isLoading;
  const isError = organizaciones.isError || necesidades.isError || donaciones.isError;

  const hasNecesidades = (necesidades.data?.length ?? 0) > 0;
  const hasDonaciones = (donaciones.data?.length ?? 0) > 0;

  const necesidadesData = necesidadesPorEstado(necesidades.data ?? []);
  const donacionesData = donacionesPorEstado(donaciones.data ?? []);

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
      </div>
    </AsyncSection>
  );
}
