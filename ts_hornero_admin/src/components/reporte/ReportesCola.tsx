import { useState } from 'react';
import { AsyncSection } from '../AsyncSection';
import { Button } from '../ui/Button';
import { PaginatedTable } from '../ui/PaginatedTable';
import type { Column } from '../ui/PaginatedTable';
import { Text } from '../ui/Typography';
import {
  useDescartarReporte,
  useMarcarInactiva,
  useReporte,
  useReportesPendientes,
} from '../../lib/hooks/useReportes';
import { usePageClamp } from '../../lib/hooks/usePageClamp';
import { mapReporteError } from '../../lib/hooks/mapReporteError';
import { MOTIVO_REPORTE } from '../../lib/domain-ui';
import { formatFecha } from '../../lib/format';
import type { Reporte } from '../../types/domain';

const PAGE_SIZE = 20;

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text variant="label" color="ink-3" as="div">{label}</Text>
      <Text variant="body" as="div">{children}</Text>
    </div>
  );
}

/** Detail + decision panel of one pending report: "Marcar inactiva" or "Descartar" (nota required). */
function ReporteDetalle({ id, onResuelto }: { id: number; onResuelto(): void }) {
  const detalle = useReporte(id);
  const marcar = useMarcarInactiva();
  const descartar = useDescartarReporte();
  const [descartando, setDescartando] = useState(false);
  const [nota, setNota] = useState('');
  const [notaError, setNotaError] = useState(false);

  const r = detalle.data;
  const error = marcar.error ?? descartar.error;
  const ocupado = marcar.isPending || descartar.isPending;

  async function handleMarcar() {
    try {
      await marcar.mutateAsync({ id });
      onResuelto();
    } catch (err) {
      void err; // surfaced below
    }
  }

  async function handleDescartar() {
    if (!nota.trim()) {
      setNotaError(true);
      return;
    }
    setNotaError(false);
    try {
      await descartar.mutateAsync({ id, nota: nota.trim() });
      onResuelto();
    } catch (err) {
      void err; // surfaced below
    }
  }

  return (
    <AsyncSection
      isLoading={detalle.isLoading}
      isError={detalle.isError}
      isEmpty={!r}
      onRetry={() => { void detalle.refetch(); }}
    >
      {r && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <Dato label="Reportado por">{r.reportanteNombre} · {r.reportanteEmail}</Dato>
            <Dato label="Motivo">{MOTIVO_REPORTE[r.motivo]?.label ?? r.motivo}</Dato>
            {r.organizacionDuplicadaNombre && (
              <Dato label="Es el mismo que">{r.organizacionDuplicadaNombre}</Dato>
            )}
          </div>

          {r.detalle && <Dato label="Detalle">{r.detalle}</Dato>}

          {descartando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={`nota-${id}`}>
                <Text as="span" variant="label" color="ink-2">Nota del descarte</Text>
              </label>
              <textarea
                id={`nota-${id}`}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                maxLength={1000}
                style={{
                  padding: '12px 14px', borderRadius: 'var(--r-input)', border: '1.5px solid var(--line)',
                  fontSize: 14.5, width: '100%', fontFamily: 'inherit', resize: 'vertical',
                }}
              />
              {notaError && <Text variant="body-sm" color="urgent">La nota es obligatoria</Text>}
            </div>
          )}

          {error && <Text variant="body-sm" color="urgent">{mapReporteError(error, 'admin')}</Text>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {descartando ? (
              <>
                <Button type="button" variant="danger" loading={descartar.isPending} disabled={ocupado}
                  onClick={() => { void handleDescartar(); }}>
                  Confirmar descarte
                </Button>
                <Button type="button" variant="ghost" disabled={ocupado}
                  onClick={() => { setDescartando(false); setNotaError(false); }}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setDescartando(true)}>
                  Descartar…
                </Button>
                <Button type="button" variant="primary" loading={marcar.isPending} disabled={ocupado}
                  onClick={() => { void handleMarcar(); }}>
                  Marcar inactiva
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </AsyncSection>
  );
}

/** Admin queue of pending reports on unclaimed comedores (the "Reportes" tab of the Reclamos page). */
export function ReportesCola() {
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const cola = useReportesPendientes({ page, size: PAGE_SIZE });
  usePageClamp(page, setPage, cola.data?.totalPages);
  const rows = cola.data?.content ?? [];

  const columns: Column<Reporte>[] = [
    { key: 'comedor', header: 'Comedor', render: (r) => <Text variant="body">{r.organizacionNombre}</Text> },
    {
      key: 'lugar',
      header: 'Lugar',
      render: (r) => <Text variant="body-sm" color="ink-3">{r.organizacionDireccion ?? '—'}</Text>,
    },
    {
      key: 'motivo',
      header: 'Motivo',
      render: (r) => <Text variant="body-sm">{MOTIVO_REPORTE[r.motivo]?.label ?? r.motivo}</Text>,
    },
    { key: 'reportante', header: 'Reportado por', render: (r) => <Text variant="body-sm">{r.reportanteNombre}</Text> },
    { key: 'fecha', header: 'Fecha', render: (r) => <Text variant="body-sm" color="ink-3">{formatFecha(r.creadoEn)}</Text> },
  ];

  return (
    <>
      <Text variant="body-sm" color="ink-3" style={{ marginTop: 4, display: 'block' }}>
        Avisos de visitantes sobre comedores importados del registro que ya no funcionan o tienen datos incorrectos.
      </Text>
      <AsyncSection
        isLoading={cola.isLoading}
        isError={cola.isError}
        isEmpty={rows.length === 0}
        emptyLabel="No hay reportes pendientes"
        onRetry={() => { void cola.refetch(); }}
      >
        <div style={{ marginTop: 20 }}>
          <PaginatedTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            page={cola.data ?? { number: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 }}
            onPageChange={setPage}
            isFetching={cola.isFetching}
            rowStyle={(r) => (r.id === selectedId ? { background: 'var(--card-2)' } : undefined)}
            rowActions={(r) => (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedId((cur) => (cur === r.id ? null : r.id))}
              >
                {selectedId === r.id ? 'Cerrar' : 'Ver detalle'}
              </Button>
            )}
            expandedKeys={selectedId != null ? new Set([selectedId]) : undefined}
            renderRowDetail={(r) => <ReporteDetalle id={r.id} onResuelto={() => setSelectedId(null)} />}
          />
        </div>
      </AsyncSection>
    </>
  );
}
