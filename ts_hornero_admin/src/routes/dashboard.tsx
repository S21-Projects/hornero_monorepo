import { AsyncSection } from '../components/AsyncSection';
import { Text } from '../components/ui/Typography';
import { ChartCard } from '../components/panel/ChartCard';
import { ChartEmptyState } from '../components/panel/ChartEmptyState';
import { MetricBarChart, MetricPieChart } from '../components/panel/MetricCharts';
import { useMiOrganizacion } from '../lib/hooks/useMiOrganizacion';
import { useNecesidadesDeOrg } from '../lib/hooks/useNecesidadesDeOrg';
import { useDonacionesDeMiOrg } from '../lib/hooks/useDonacionesDeMiOrg';
import { necesidadesPorEstado, donacionesPorEstado } from '../lib/metricas';

export default function DashboardPage() {
  const organizacion = useMiOrganizacion();
  const necesidades = useNecesidadesDeOrg(organizacion.data?.id);
  const donaciones = useDonacionesDeMiOrg();

  const isLoading = organizacion.isLoading || necesidades.isLoading || donaciones.isLoading;
  const isError = organizacion.isError || necesidades.isError || donaciones.isError;

  const hasNecesidades = (necesidades.data?.length ?? 0) > 0;
  const hasDonaciones = (donaciones.data?.length ?? 0) > 0;

  const necesidadesData = necesidadesPorEstado(necesidades.data ?? []);
  const donacionesData = donacionesPorEstado(donaciones.data ?? []);

  return (
    <AsyncSection isLoading={isLoading} isError={isError} isEmpty={false}>
      <div>
        <Text variant="h1">Resumen de {organizacion.data?.nombre ?? 'mi organización'}</Text>

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
