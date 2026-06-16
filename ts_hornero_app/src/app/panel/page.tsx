'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AdminShell } from '@/components/ui/admin-shell';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth.store';
import { usePanelMetricas } from '@/hooks/usePanelMetricas';
import { StatCard } from '@/components/panel/StatCard';
import { ChartCard } from '@/components/panel/ChartCard';
import { ChartEmptyState } from '@/components/panel/ChartEmptyState';
import { MetricBarChart, MetricPieChart } from '@/components/panel/MetricCharts';
import {
  organizacionesPorTipo,
  necesidadesPorEstado,
  necesidadesPorPrioridad,
  donacionesPorEstado,
  usuariosPorRol,
} from '@/lib/metricas';

export default function PanelPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  const {
    isAdmin, isLoading, isError, refetch,
    organizaciones, pendientes, necesidades, donaciones, usuarios,
  } = usePanelMetricas();

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  return (
    <AdminShell active="Panel" title="Panel" subtitle="Métricas generales de la red de comedores">
      {isError ? (
        <ErrorState
          message="No pudimos cargar las métricas del panel. Intentá de nuevo en unos momentos."
          onRetry={refetch}
        />
      ) : isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={94} borderRadius={18} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={320} borderRadius={18} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <StatCard label="Organizaciones activas" value={organizaciones.length} />
            <StatCard label="Necesidades publicadas" value={necesidades.length} />
            <StatCard label="Donaciones registradas" value={donaciones.length} />
            {isAdmin ? (
              <StatCard label="Organizaciones pendientes" value={pendientes.length} />
            ) : (
              <StatCard
                label="Necesidades abiertas"
                value={necesidades.filter((n) => n.estado === 'ABIERTA').length}
              />
            )}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <ChartCard title="Necesidades por estado" subtitle="Distribución del total de necesidades publicadas">
              {necesidades.length === 0 ? (
                <ChartEmptyState message="Todavía no hay necesidades publicadas." />
              ) : (
                <MetricBarChart data={necesidadesPorEstado(necesidades)} />
              )}
            </ChartCard>

            <ChartCard title="Necesidades por prioridad" subtitle="Urgencia de las necesidades publicadas">
              {necesidades.length === 0 ? (
                <ChartEmptyState message="Todavía no hay necesidades publicadas." />
              ) : (
                <MetricPieChart data={necesidadesPorPrioridad(necesidades)} />
              )}
            </ChartCard>

            <ChartCard title="Donaciones por estado" subtitle="Estado actual de las donaciones registradas">
              {donaciones.length === 0 ? (
                <ChartEmptyState message="Todavía no se registraron donaciones." />
              ) : (
                <MetricPieChart data={donacionesPorEstado(donaciones)} />
              )}
            </ChartCard>

            <ChartCard title="Organizaciones por tipo" subtitle="Tipos de organizaciones activas en la red">
              {organizaciones.length === 0 ? (
                <ChartEmptyState message="Todavía no hay organizaciones activas." />
              ) : (
                <MetricBarChart data={organizacionesPorTipo(organizaciones)} />
              )}
            </ChartCard>

            {isAdmin && (
              <ChartCard title="Usuarios por rol" subtitle="Distribución de roles registrados en la plataforma">
                {usuarios.length === 0 ? (
                  <ChartEmptyState message="Todavía no hay usuarios registrados." />
                ) : (
                  <MetricBarChart data={usuariosPorRol(usuarios)} />
                )}
              </ChartCard>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
