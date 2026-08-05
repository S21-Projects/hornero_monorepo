import { AsyncSection } from '../components/AsyncSection';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Typography';
import { ChartCard } from '../components/panel/ChartCard';
import { ChartEmptyState } from '../components/panel/ChartEmptyState';
import { MetricBarChart, MetricPieChart } from '../components/panel/MetricCharts';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { deriveAdminSummary } from '../lib/deriveAdminSummary';
import { usuariosPorRol, countByField } from '../lib/metricas';

const ACTIVO_LABELS: Record<string, string> = {
  true: 'Activos',
  false: 'Inactivos',
};

export default function AdminPage() {
  const pendientes = useOrganizacionesPendientes();
  // size:100 — a single reshaped fetch feeds the charts, the active count,
  // and totalUserCount (free via totalElements); no separate probe request.
  // TODO [tech-debt]: replace with MS ?activo= filter or dedicated aggregation
  // endpoint — see backlog.
  const usuarios = useUsuarios({ page: 0, size: 100 });

  const isLoading = pendientes.isLoading || usuarios.isLoading;
  const isError = pendientes.isError || usuarios.isError;

  const summary =
    pendientes.data != null && usuarios.data != null
      ? deriveAdminSummary(pendientes.data, usuarios.data)
      : null;

  const usuariosContent = usuarios.data?.content ?? [];
  const hasUsuarios = usuariosContent.length > 0;
  const usuariosPorRolData = usuariosPorRol(usuariosContent);
  const usuariosPorActivoData = countByField(usuariosContent, 'activo', ACTIVO_LABELS);

  return (
    <AsyncSection
      isLoading={isLoading}
      isError={isError}
      isEmpty={false} // summary always renders counts; never an empty state
    >
      <div>
        <Text variant="h1">Resumen</Text>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginTop: 20,
          }}
        >
          <Card style={{ padding: 20 }}>
            <Text variant="caption">Organizaciones pendientes</Text>
            <Text variant="stat" style={{ marginTop: 8 }}>{summary?.pendingOrgCount ?? '—'}</Text>
          </Card>
          <Card style={{ padding: 20 }}>
            <Text variant="caption">Total de usuarios</Text>
            <Text variant="stat" style={{ marginTop: 8 }}>{summary?.totalUserCount ?? '—'}</Text>
          </Card>
          <Card style={{ padding: 20 }}>
            <Text variant="caption">Usuarios activos</Text>
            <Text variant="stat" style={{ marginTop: 8 }}>{summary?.activeUserCount ?? '—'}</Text>
            {summary?.activeUserCountIsPartial && (
              <Text variant="micro" color="ink-3" style={{ marginTop: 4 }}>
                Sobre los primeros {usuariosContent.length}
              </Text>
            )}
          </Card>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
            marginTop: 24,
          }}
        >
          <ChartCard title="Usuarios por rol" subtitle="Distribución de roles en la plataforma">
            {hasUsuarios ? (
              <MetricBarChart data={usuariosPorRolData} />
            ) : (
              <ChartEmptyState message="Todavía no hay usuarios cargados." />
            )}
          </ChartCard>
          <ChartCard title="Usuarios activos vs. inactivos" subtitle="Estado de las cuentas de usuario">
            {hasUsuarios ? (
              <MetricPieChart data={usuariosPorActivoData} />
            ) : (
              <ChartEmptyState message="Todavía no hay usuarios cargados." />
            )}
          </ChartCard>
        </div>
      </div>
    </AsyncSection>
  );
}
