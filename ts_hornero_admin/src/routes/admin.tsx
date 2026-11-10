import { Link } from 'react-router-dom';
import { AsyncSection } from '../components/AsyncSection';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { ChartCard } from '../components/panel/ChartCard';
import { ChartEmptyState } from '../components/panel/ChartEmptyState';
import { MetricBarChart, MetricPieChart } from '../components/panel/MetricCharts';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { deriveAdminSummary } from '../lib/deriveAdminSummary';
import type { UsuarioCounts } from '../lib/deriveAdminSummary';
import { ROLE_LABELS } from '../lib/metricas';
import type { CountItem } from '../lib/metricas';
import type { UserRole } from '../store/auth.store';

const ACTIVO_LABELS: Record<string, string> = {
  true: 'Activos',
  false: 'Inactivos',
};

const ROLES: UserRole[] = ['ADMINISTRADOR', 'REFERENTE', 'DONANTE'];

export default function AdminPage() {
  const pendientes = useOrganizacionesPendientes();
  // Counts only: each query asks for one row and reads `totalElements`, so the
  // numbers stay exact however many users exist (no page-size cap).
  const admins = useUsuarios({ page: 0, size: 1, tipo: 'ADMINISTRADOR' });
  const referentes = useUsuarios({ page: 0, size: 1, tipo: 'REFERENTE' });
  const donantes = useUsuarios({ page: 0, size: 1, tipo: 'DONANTE' });
  const activos = useUsuarios({ page: 0, size: 1, activo: true });
  const porRolQueries = [admins, referentes, donantes];

  const isLoading = pendientes.isLoading || porRolQueries.some((q) => q.isLoading) || activos.isLoading;
  const isError = pendientes.isError || porRolQueries.some((q) => q.isError) || activos.isError;

  const countsListos = porRolQueries.every((q) => q.data != null) && activos.data != null;
  const usuarioCounts: UsuarioCounts | null =
    countsListos
      ? {
          porRol: {
            ADMINISTRADOR: admins.data?.totalElements ?? 0,
            REFERENTE: referentes.data?.totalElements ?? 0,
            DONANTE: donantes.data?.totalElements ?? 0,
          },
          activos: activos.data?.totalElements ?? 0,
        }
      : null;

  const summary =
    pendientes.data != null && usuarioCounts != null ? deriveAdminSummary(pendientes.data, usuarioCounts) : null;

  const hasUsuarios = (summary?.totalUserCount ?? 0) > 0;
  const usuariosPorRolData: CountItem[] = ROLES.map((rol) => ({
    key: rol,
    label: ROLE_LABELS[rol],
    value: usuarioCounts?.porRol[rol] ?? 0,
  }));
  const usuariosPorActivoData: CountItem[] = [
    { key: 'true', label: ACTIVO_LABELS.true, value: summary?.activeUserCount ?? 0 },
    {
      key: 'false',
      label: ACTIVO_LABELS.false,
      value: (summary?.totalUserCount ?? 0) - (summary?.activeUserCount ?? 0),
    },
  ];

  return (
    <AsyncSection
      isLoading={isLoading}
      isError={isError}
      isEmpty={false} // summary always renders counts; never an empty state
    >
      <div>
        <PageHeader
          title="Resumen"
          description="Una vista general de la actividad y el estado de la plataforma."
        />

        <Card style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Text variant="title">Auditoría de acreditación</Text>
            <Text variant="body-sm" color="ink-3">
              Revisá la evidencia enviada por cada organización y confirmá o rechazá su nivel.
            </Text>
          </div>
          <Link to="/referentes">
            <Button variant="secondary" size="sm">Ir a la cola de auditoría</Button>
          </Link>
        </Card>

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
