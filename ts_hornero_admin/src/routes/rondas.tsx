import { useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { useEjecutarRonda, useFondoRonda, useHistorialRondas } from '../lib/hooks/useRondas';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { formatFecha } from '../lib/format';
import type { RondaResponse } from '../types/domain';

const PAGE_SIZE = 20;

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

/** `ejecutadaEn`/`finalizadaEn` are `Instant` timestamps; `formatFecha` expects `YYYY-MM-DD`. */
function formatFechaHora(iso: string): string {
  return formatFecha(iso.slice(0, 10));
}

/**
 * `/rondas` (ADMINISTRADOR) — AD-9, spec `ronda-asignacion`: pool state, manual "Ejecutar ronda"
 * trigger behind a confirmation step, the last run's result summary, and the paginated ronda
 * history. There is no scheduler — this screen is the only way to run a ronda.
 */
export default function RondasPage() {
  const [page, setPage] = useState(0);
  const [confirmando, setConfirmando] = useState(false);

  const fondo = useFondoRonda();
  const historial = useHistorialRondas({ page, size: PAGE_SIZE });
  const ejecutar = useEjecutarRonda();

  usePageClamp(page, setPage, historial.data?.totalPages);

  const rows = historial.data?.content ?? [];

  function handleEjecutarClick() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setConfirmando(false);
    ejecutar.mutate();
  }

  const columns: Column<RondaResponse>[] = [
    { key: 'fecha', header: 'Fecha', render: (r) => <Text variant="body-sm">{formatFechaHora(r.ejecutadaEn)}</Text> },
    { key: 'estado', header: 'Estado', render: (r) => <Badge tone={r.estado === 'COMPLETADA' ? 'ok' : 'danger'} label={r.estado} /> },
    { key: 'asignadas', header: 'Asignadas', align: 'right', render: (r) => <Text variant="body-sm">{r.asignadas}</Text> },
    { key: 'sinAsignar', header: 'Sin asignar', align: 'right', render: (r) => <Text variant="body-sm">{r.sinAsignar}</Text> },
    { key: 'score', header: 'Score total', align: 'right', render: (r) => <Text variant="body-sm">{r.scoreTotal != null ? r.scoreTotal.toFixed(2) : '—'}</Text> },
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

      <Card style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Text variant="label">Donaciones en espera</Text>
            <Text variant="h2" style={{ marginTop: 4 }}>{fondo.data?.pendientes ?? 0}</Text>
            {fondo.data?.masAntiguaDesde && (
              <Text variant="body-sm" color="ink-3" as="p" style={{ marginTop: 4 }}>
                La más antigua espera desde el {formatFecha(fondo.data.masAntiguaDesde)}
              </Text>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <Button
              type="button"
              variant={confirmando ? 'danger' : 'primary'}
              onClick={handleEjecutarClick}
              disabled={ejecutar.isPending}
            >
              {confirmando ? 'Confirmar ejecución' : 'Ejecutar ronda'}
            </Button>
            {confirmando && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {ejecutar.isError && (
          <Text variant="body-sm" color="urgent" as="p" style={{ marginTop: 16 }}>
            {mensajeError(errorStatus(ejecutar.error))}
          </Text>
        )}

        {ejecutar.isSuccess && ejecutar.data && (
          <Card style={{ padding: '14px 18px', marginTop: 16, background: 'var(--card-2)' }}>
            <Text variant="label" as="p" style={{ marginBottom: 6 }}>Resultado de la última ronda</Text>
            <Text variant="body-sm" as="p">
              Estado: {ejecutar.data.estado} · Asignadas: {ejecutar.data.asignadas} · Sin asignar:{' '}
              {ejecutar.data.sinAsignar} · Descartadas: {ejecutar.data.descartadas}
            </Text>
          </Card>
        )}
      </Card>

      <Text variant="h3" style={{ marginTop: 28, marginBottom: 12 }}>Historial de rondas</Text>

      <AsyncSection
        isLoading={historial.isLoading}
        isError={historial.isError}
        isEmpty={rows.length === 0}
        emptyLabel="Todavía no se ejecutó ninguna ronda."
      >
        <PaginatedTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          page={historial.data ?? { number: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 }}
          onPageChange={setPage}
          isFetching={historial.isFetching}
        />
      </AsyncSection>
    </div>
  );
}
