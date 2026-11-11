import { useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { RondaDrawer } from '../components/ronda/RondaDrawer';
import { useEjecutarRonda, useFondoRonda, useHistorialRondas } from '../lib/hooks/useRondas';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { ESTADO_RONDA, FALLBACK_BADGE, ORIGEN_RONDA } from '../lib/domain-ui';
import { formatDecimal, formatFecha, formatFechaHora } from '../lib/format';
import type { RondaResponse } from '../types/domain';

const PAGE_SIZE = 10;

/** `RondaController`/`RondasService` friendly error copy, per task 5f.12's status-code mapping. */
function mensajeError(status: number | undefined): string {
  if (status === 409) return 'Ya hay una ronda en curso. Esperá a que termine e intentá de nuevo.';
  if (status === 503) return 'El motor de asignación no está disponible en este momento.';
  if (status === 502) return 'El motor de asignación devolvió una respuesta inválida.';
  return 'Ocurrió un error al ejecutar la ronda. Intentá de nuevo.';
}

function errorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

/**
 * `/rondas` (ADMINISTRADOR) — AD-9, spec `ronda-asignacion`: pool state, manual "Ejecutar ronda"
 * trigger behind a confirmation dialog, the last run's result and the paginated ronda history,
 * whose rows open a drawer with the ronda's assignments and summary. There is no scheduler on
 * the UI side — this screen is the manual way to run a ronda.
 */
export default function RondasPage() {
  const [page, setPage] = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const [detalle, setDetalle] = useState<RondaResponse | null>(null);

  const fondo = useFondoRonda();
  const historial = useHistorialRondas({ page, size: PAGE_SIZE });
  const ejecutar = useEjecutarRonda();

  usePageClamp(page, setPage, historial.data?.totalPages);

  const rows = historial.data?.content ?? [];
  const pendientes = fondo.data?.pendientes ?? 0;
  // The run just triggered wins; otherwise the newest history item.
  const ultima: RondaResponse | undefined =
    ejecutar.isSuccess && ejecutar.data ? ejecutar.data : (page === 0 ? rows[0] : undefined);
  const estadoUltima = ultima ? (ESTADO_RONDA[ultima.estado] ?? FALLBACK_BADGE) : null;

  function handleConfirmar() {
    ejecutar.mutate(undefined, { onSettled: () => setConfirmando(false) });
  }

  const columns: Column<RondaResponse>[] = [
    { key: 'fecha', header: 'Fecha', render: (r) => <Text variant="body-sm">{formatFechaHora(r.ejecutadaEn)}</Text> },
    {
      key: 'origen',
      header: 'Origen',
      render: (r) => {
        const o = ORIGEN_RONDA[r.origen] ?? FALLBACK_BADGE;
        return <Badge tone={o.tone} label={o.label} />;
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (r) => {
        const e = ESTADO_RONDA[r.estado] ?? FALLBACK_BADGE;
        return <Badge tone={e.tone} label={e.label} />;
      },
    },
    { key: 'asignadas', header: 'Asignadas', align: 'right', render: (r) => <Text variant="body-sm">{r.asignadas}</Text> },
    { key: 'sinAsignar', header: 'Sin asignar', align: 'right', render: (r) => <Text variant="body-sm">{r.sinAsignar}</Text> },
    {
      key: 'score',
      header: 'Score total',
      align: 'right',
      render: (r) => (
        <Text variant="body-sm" title="Suma de los puntajes de la ronda">
          {r.scoreTotal != null ? formatDecimal(r.scoreTotal) : '—'}
        </Text>
      ),
    },
    {
      key: 'ejecutadaPor',
      header: 'Ejecutada por',
      render: (r) => (
        <Text variant="body-sm" color="ink-3">
          {r.origen === 'AUTOMATICA' ? 'Automática' : (r.ejecutadaPorNombre ?? `Admin #${r.ejecutadaPor}`)}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Rondas de asignación"
        description="Ejecutá manualmente el motor de asignación para las donaciones de fondo común en espera."
      />

      <Card className="card-pad fondo-card">
        <div>
          <Text variant="label">Fondo común</Text>
          <Text variant="h2" as="p">{pendientes}</Text>
          <Text variant="body-sm" color="ink-3" as="p">
            {pendientes === 1 ? 'donación en espera' : 'donaciones en espera'}
          </Text>
          {fondo.data?.masAntiguaDesde && (
            <Text variant="body-sm" color="ink-3" as="p">
              La más antigua espera desde el {formatFecha(fondo.data.masAntiguaDesde)}
            </Text>
          )}
        </div>

        <div className="fondo-card__action">
          <Button
            type="button"
            variant="primary"
            onClick={() => setConfirmando(true)}
            disabled={pendientes === 0 || ejecutar.isPending}
          >
            Ejecutar ronda
          </Button>
          {pendientes === 0 && (
            <Text variant="body-sm" color="ink-3">No hay donaciones en espera para asignar.</Text>
          )}
        </div>
      </Card>

      {ejecutar.isError && (
        <div className="banner-bad" role="alert">
          <Text variant="body-sm" as="p">{mensajeError(errorStatus(ejecutar.error))}</Text>
        </div>
      )}

      {ultima && estadoUltima && (
        <>
          <div className="section-head">
            <div>
              <Text variant="h3" as="h2">Resultado de la última ronda</Text>
              <Text variant="body-sm" color="ink-3" as="p">
                Ronda #{ultima.id} · {formatFechaHora(ultima.ejecutadaEn)}
              </Text>
            </div>
            <div className="list-card__badges">
              <Badge tone={estadoUltima.tone} label={estadoUltima.label} />
              <Button type="button" variant="secondary" size="sm" onClick={() => setDetalle(ultima)}>
                Ver detalle
              </Button>
            </div>
          </div>
          {ultima.estado === 'FALLIDA' && (
            <div className="banner-bad" role="alert">
              <Text variant="body-sm" as="p">{ultima.error ?? 'La ronda falló sin indicar un motivo.'}</Text>
            </div>
          )}
          <div className="stat-grid">
            <StatCard value={ultima.asignadas} label="Asignadas" accent />
            <StatCard value={ultima.sinAsignar} label="Sin asignar" />
            <StatCard value={ultima.descartadas} label="Descartadas" />
            <StatCard value={ultima.donacionesConsideradas} label="Donaciones consideradas" />
            <StatCard value={ultima.candidatosConsiderados} label="Candidatos considerados" />
          </div>
        </>
      )}

      <div className="section-head">
        <Text variant="h3" as="h2">Historial de rondas</Text>
      </div>

      <PaginatedTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        isLoading={historial.isLoading}
        isError={historial.isError}
        onRetry={() => { void historial.refetch(); }}
        emptyLabel="Todavía no se ejecutó ninguna ronda."
        page={historial.data ?? { number: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 }}
        onPageChange={setPage}
        isFetching={historial.isFetching}
        onRowClick={setDetalle}
        selectedKey={detalle?.id}
      />

      <ConfirmDialog
        open={confirmando}
        tone="primary"
        title="¿Ejecutar una ronda ahora?"
        description={`Se van a considerar ${pendientes} ${pendientes === 1 ? 'donación' : 'donaciones'} del fondo común. Las asignaciones quedan propuestas a cada comedor.`}
        confirmLabel="Ejecutar ronda"
        loading={ejecutar.isPending}
        onConfirm={handleConfirmar}
        onCancel={() => setConfirmando(false)}
      />

      {detalle && <RondaDrawer ronda={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}
