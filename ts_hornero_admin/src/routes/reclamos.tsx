import { useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { ReclamoEvidencia } from '../components/reclamo/ReclamoEvidencia';
import { ReportesCola } from '../components/reporte/ReportesCola';
import {
  useAprobarReclamo,
  useRechazarReclamo,
  useReclamo,
  useReclamosPendientes,
} from '../lib/hooks/useReclamos';
import { useReportesPendientes } from '../lib/hooks/useReportes';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { mapReclamoError } from '../lib/hooks/mapReclamoError';
import { ROL_RECLAMO } from '../lib/domain-ui';
import { formatFecha } from '../lib/format';
import type { Reclamo } from '../types/domain';

const PAGE_SIZE = 20;

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text variant="label" color="ink-3" as="div">{label}</Text>
      <Text variant="body" as="div">{children}</Text>
    </div>
  );
}

/** Detail + decision panel of one pending claim (mockup screen 5). */
function ReclamoDetalle({ id, onResuelto }: { id: number; onResuelto(): void }) {
  const detalle = useReclamo(id);
  const aprobar = useAprobarReclamo();
  const rechazar = useRechazarReclamo();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [motivoError, setMotivoError] = useState(false);

  const r = detalle.data;
  const error = aprobar.error ?? rechazar.error;
  const ocupado = aprobar.isPending || rechazar.isPending;

  async function handleAprobar() {
    try {
      await aprobar.mutateAsync({ id });
      onResuelto();
    } catch (err) {
      void err; // surfaced below
    }
  }

  async function handleRechazar() {
    if (!motivo.trim()) {
      setMotivoError(true);
      return;
    }
    setMotivoError(false);
    try {
      await rechazar.mutateAsync({ id, motivo: motivo.trim() });
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
            <Dato label="Solicitante">{r.solicitanteNombre} · {r.solicitanteEmail}</Dato>
            <Dato label="Rol en el comedor">{ROL_RECLAMO[r.rol] ?? r.rol}</Dato>
            <Dato label="Organizaciones a cargo">
              {r.organizacionesACargo ?? 0}/{r.capOrganizaciones ?? 3}
            </Dato>
            <Dato label="Teléfono">{r.telefono}</Dato>
          </div>

          {r.mensaje && <Dato label="Mensaje">{r.mensaje}</Dato>}

          <div>
            <Text variant="label" color="ink-3" as="div" style={{ marginBottom: 6 }}>Evidencia</Text>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {r.evidenciaKeys.map((key) => (
                <ReclamoEvidencia
                  key={key}
                  organizacionId={r.organizacionId}
                  solicitanteId={r.solicitanteId}
                  objectKey={key}
                />
              ))}
            </div>
          </div>

          {rechazando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={`motivo-${id}`}>
                <Text as="span" variant="label" color="ink-2">Motivo del rechazo</Text>
              </label>
              <textarea
                id={`motivo-${id}`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={1000}
                style={{
                  padding: '12px 14px', borderRadius: 'var(--r-input)', border: '1.5px solid var(--line)',
                  fontSize: 14.5, width: '100%', fontFamily: 'inherit', resize: 'vertical',
                }}
              />
              {motivoError && <Text variant="body-sm" color="urgent">El motivo es obligatorio</Text>}
            </div>
          )}

          {error && <Text variant="body-sm" color="urgent">{mapReclamoError(error, 'admin')}</Text>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {rechazando ? (
              <>
                <Button type="button" variant="danger" loading={rechazar.isPending} disabled={ocupado}
                  onClick={() => { void handleRechazar(); }}>
                  Confirmar rechazo
                </Button>
                <Button type="button" variant="ghost" disabled={ocupado}
                  onClick={() => { setRechazando(false); setMotivoError(false); }}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setRechazando(true)}>
                  Rechazar…
                </Button>
                <Button type="button" variant="primary" loading={aprobar.isPending} disabled={ocupado}
                  onClick={() => { void handleAprobar(); }}>
                  Aprobar y asignar
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </AsyncSection>
  );
}

/** Pending claims on unclaimed comedores (the "Reclamos" tab). */
function ReclamosCola() {
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const cola = useReclamosPendientes({ page, size: PAGE_SIZE });
  usePageClamp(page, setPage, cola.data?.totalPages);

  const rows = cola.data?.content ?? [];
  const total = cola.data?.totalElements ?? 0;

  const columns: Column<Reclamo>[] = [
    { key: 'comedor', header: 'Comedor', render: (r) => <Text variant="body">{r.organizacionNombre}</Text> },
    {
      key: 'lugar',
      header: 'Lugar',
      render: (r) => <Text variant="body-sm" color="ink-3">{r.organizacionDireccion ?? '—'}</Text>,
    },
    { key: 'solicitante', header: 'Solicitante', render: (r) => <Text variant="body-sm">{r.solicitanteNombre}</Text> },
    { key: 'fecha', header: 'Fecha', render: (r) => <Text variant="body-sm" color="ink-3">{formatFecha(r.creadoEn)}</Text> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Badge tone={total > 0 ? 'sky' : 'neutral'} label={`${total} pendientes`} />
      </div>
      <Text variant="body-sm" color="ink-3" style={{ marginTop: 4, display: 'block' }}>
        Pedidos de referentes para hacerse cargo de un comedor importado del registro.
      </Text>

      <AsyncSection
        isLoading={cola.isLoading}
        isError={cola.isError}
        isEmpty={rows.length === 0}
        emptyLabel="No hay reclamos pendientes"
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
            renderRowDetail={(r) => <ReclamoDetalle id={r.id} onResuelto={() => setSelectedId(null)} />}
          />
        </div>
      </AsyncSection>
    </div>
  );
}

type Tab = 'reclamos' | 'reportes';

/**
 * Admin queues for unclaimed comedores: claims by referentes ("Reclamos") and visitor reports
 * ("Reportes"). ADMINISTRADOR-only (router guard). Tab counts reuse the queues' first-page queries.
 */
export default function ReclamosPage() {
  const [tab, setTab] = useState<Tab>('reclamos');
  const reclamos = useReclamosPendientes({ page: 0, size: PAGE_SIZE });
  const reportes = useReportesPendientes({ page: 0, size: PAGE_SIZE });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'reclamos', label: `Reclamos · ${reclamos.data?.totalElements ?? 0}` },
    { id: 'reportes', label: `Reportes · ${reportes.data?.totalElements ?? 0}` },
  ];

  return (
    <div>
      <PageHeader
        title="Reclamos y reportes"
        description="Revisá los reclamos de comedores sin reclamar y los reportes enviados por los usuarios."
      />

      <div role="tablist" aria-label="Comedores sin reclamar" style={{ display: 'flex', gap: 8 }}>
        {tabs.map((t) => (
          <Button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            variant={tab === t.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'reclamos' ? <ReclamosCola /> : <ReportesCola />}
      </div>
    </div>
  );
}
