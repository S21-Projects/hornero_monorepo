import { useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { Drawer } from '../components/ui/Drawer';
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

const PAGE_SIZE = 10;

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text variant="label" color="ink-3" as="div">{label}</Text>
      <Text variant="body" as="div">{children}</Text>
    </div>
  );
}

/** Detail + decision drawer of one pending claim (mockup screen 5). */
function ReclamoDrawer({ row, onClose }: { row: Reclamo; onClose(): void }) {
  const id = row.id;
  const detalle = useReclamo(id);
  const aprobar = useAprobarReclamo();
  const rechazar = useRechazarReclamo();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const r = detalle.data;
  const error = aprobar.error ?? rechazar.error;
  const ocupado = aprobar.isPending || rechazar.isPending;
  const aCargo = r?.organizacionesACargo ?? 0;
  const cap = r?.capOrganizaciones ?? 3;
  const enElTope = r != null && r.organizacionesACargo != null && aCargo >= cap;

  async function handleAprobar() {
    try {
      await aprobar.mutateAsync({ id });
      onClose();
    } catch (err) {
      void err; // surfaced in the body
    }
  }

  async function handleRechazar() {
    if (!motivo.trim()) return;
    try {
      await rechazar.mutateAsync({ id, motivo: motivo.trim() });
      onClose();
    } catch (err) {
      void err; // surfaced in the body
    }
  }

  const footer = rechazando ? (
    <>
      <Button type="button" variant="ghost" disabled={ocupado} onClick={() => setRechazando(false)}>
        Volver
      </Button>
      <Button type="button" variant="danger" loading={rechazar.isPending}
        disabled={ocupado || !motivo.trim()} onClick={() => { void handleRechazar(); }}>
        Confirmar rechazo
      </Button>
    </>
  ) : (
    <>
      <Button type="button" variant="secondary" disabled={ocupado || !r} onClick={() => setRechazando(true)}>
        Rechazar…
      </Button>
      <Button type="button" variant="primary" loading={aprobar.isPending}
        disabled={ocupado || !r || enElTope} onClick={() => { void handleAprobar(); }}>
        Aprobar y asignar
      </Button>
    </>
  );

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Reclamo de comedor"
      title={row.organizacionNombre}
      status={<Text variant="body-sm" color="ink-3">{row.organizacionDireccion ?? 'Sin dirección'} · {formatFecha(row.creadoEn)}</Text>}
      footer={footer}
    >
      <AsyncSection
        isLoading={detalle.isLoading}
        isError={detalle.isError}
        isEmpty={!r}
        onRetry={() => { void detalle.refetch(); }}
      >
        {r && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Dato label="Solicitante">{r.solicitanteNombre}</Dato>
            <Dato label="Email">{r.solicitanteEmail}</Dato>
            <Dato label="Teléfono">{r.telefono}</Dato>
            <Dato label="Rol en el comedor">{ROL_RECLAMO[r.rol] ?? r.rol}</Dato>
            <Dato label="Organizaciones a cargo">{aCargo}/{cap}</Dato>

            {enElTope && (
              <div role="alert" style={{
                padding: '10px 14px', borderRadius: 'var(--r-input)', border: '1px solid var(--urgent)',
                background: 'var(--card-2)',
              }}>
                <Text variant="body-sm" color="urgent">
                  El solicitante ya alcanzó el máximo de {cap} organizaciones a su cargo: no se puede aprobar.
                </Text>
              </div>
            )}

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
              </div>
            )}

            {error && <Text variant="body-sm" color="urgent">{mapReclamoError(error, 'admin')}</Text>}
          </div>
        )}
      </AsyncSection>
    </Drawer>
  );
}

/** Pending claims on unclaimed comedores (the "Reclamos" tab). */
function ReclamosCola() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const cola = useReclamosPendientes({ page, size: pageSize });
  usePageClamp(page, setPage, cola.data?.totalPages);

  const rows = cola.data?.content ?? [];
  const total = cola.data?.totalElements ?? 0;
  const selected = rows.find((r) => r.id === selectedId) ?? null;

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

      <>
        <div style={{ marginTop: 20 }}>
          <PaginatedTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            isLoading={cola.isLoading}
            isError={cola.isError}
            onRetry={() => { void cola.refetch(); }}
            emptyLabel="No hay reclamos pendientes"
            page={cola.data ?? { number: 0, size: pageSize, totalElements: 0, totalPages: 0 }}
            onPageChange={setPage}
            isFetching={cola.isFetching}
            onRowClick={(r) => setSelectedId(r.id)}
            selectedKey={selectedId ?? undefined}
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(0); }}
          />
        </div>
      </>

      {selected && <ReclamoDrawer row={selected} onClose={() => setSelectedId(null)} />}
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
