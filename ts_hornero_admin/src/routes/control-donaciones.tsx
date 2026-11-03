import { useEffect, useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { Dropdown } from '../components/ui/Dropdown';
import { Select } from '../components/ui/Select';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { useDonacionesActivas } from '../lib/hooks/useDonacionesActivas';
import { useOverrideEstadoDonacion } from '../lib/hooks/useOverrideEstadoDonacion';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { ESTADO_DONACION, FALLBACK_BADGE, MODALIDAD_DONACION, FASE_DONACION } from '../lib/domain-ui';
import { formatFecha, formatLineas } from '../lib/format';
import type { DonacionActiva, EstadoDonacion } from '../types/domain';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

// Estados visibles en el filtro (todos los que puede devolver /activas, más los
// terminales a los que un admin puede forzar una donación).
const ESTADO_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'OFRECIDA', label: 'Ofrecida' },
  { value: 'ACEPTADA', label: 'Aceptada' },
  { value: 'EN_CAMINO', label: 'En camino' },
  { value: 'PENDIENTE_CONFIRMACION', label: 'Pendiente de confirmación' },
];

// El override admin puede forzar cualquier estado no terminal más los tres terminales.
const OVERRIDE_TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: 'OFRECIDA', label: 'Ofrecida' },
  { value: 'ACEPTADA', label: 'Aceptada' },
  { value: 'EN_CAMINO', label: 'En camino' },
  { value: 'PENDIENTE_CONFIRMACION', label: 'Pendiente de confirmación' },
  { value: 'ENTREGADA', label: 'Entregada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text variant="label" color="ink-3" as="div">{label}</Text>
      <Text variant="body" as="div">{children}</Text>
    </div>
  );
}

const DRAWER_TABS = [
  { id: 'detalle', label: 'Detalle' },
  { id: 'forzar', label: 'Forzar estado' },
];

interface DonacionDrawerProps {
  donacion: DonacionActiva;
  onClose: () => void;
}

/** Right-side detail of one donación, with the admin "Forzar estado" override on its own tab. */
function DonacionDrawer({ donacion, onClose }: DonacionDrawerProps) {
  const [tab, setTab] = useState('detalle');
  const [estado, setEstado] = useState<string>(donacion.estado);
  const [motivo, setMotivo] = useState('');
  const override = useOverrideEstadoDonacion();

  const cfg = ESTADO_DONACION[donacion.estado as EstadoDonacion] ?? FALLBACK_BADGE;
  const modalidadCfg = donacion.modalidad ? (MODALIDAD_DONACION[donacion.modalidad] ?? FALLBACK_BADGE) : undefined;
  const lineas = formatLineas(donacion.lineas);
  const puedeEnviar = Boolean(estado) && Boolean(motivo.trim());

  async function handleSubmit() {
    if (!puedeEnviar) return;
    try {
      await override.mutateAsync({ id: donacion.id, estado, motivo: motivo.trim() });
      onClose();
    } catch (err) {
      void err; // surfaced in the body
    }
  }

  const footer =
    tab === 'detalle' ? (
      <>
        <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
        <Button type="button" variant="danger" onClick={() => setTab('forzar')}>Forzar estado…</Button>
      </>
    ) : (
      <>
        <Button type="button" variant="ghost" disabled={override.isPending} onClick={onClose}>Cancelar</Button>
        <Button type="button" variant="danger" loading={override.isPending} disabled={!puedeEnviar}
          onClick={() => { void handleSubmit(); }}>
          Forzar estado
        </Button>
      </>
    );

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`Donación #${donacion.id}`}
      title={donacion.organizacionNombre ?? `Donación #${donacion.id}`}
      status={
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Badge tone={cfg.tone} label={cfg.label} />
          {donacion.overrideEn && <Badge tone="danger" label="Forzada" />}
          {donacion.estancada && (
            <Badge tone="danger" label={`Estancada (${donacion.diasEnEstado ?? 0} ${donacion.diasEnEstado === 1 ? 'día' : 'días'})`} />
          )}
        </div>
      }
      tabs={DRAWER_TABS}
      activeTab={tab}
      onTabChange={setTab}
      footer={footer}
    >
      {tab === 'detalle' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {donacion.estancada && (
            <div role="alert" style={{
              padding: '10px 14px', borderRadius: 'var(--r-input)', border: '1px solid var(--urgent)',
              background: 'var(--card-2)',
            }}>
              <Text variant="body-sm" color="urgent">
                Donación estancada: lleva {donacion.diasEnEstado ?? 0} {donacion.diasEnEstado === 1 ? 'día' : 'días'} en este estado.
              </Text>
            </div>
          )}
          <Dato label="Donante">{donacion.donanteNombre ?? '—'}</Dato>
          <Dato label="Necesidad">{donacion.necesidadDescripcion ?? '—'}</Dato>
          <Dato label="Artículos">{lineas || '—'}</Dato>
          <Dato label="Modalidad">
            {modalidadCfg ? <Badge tone={modalidadCfg.tone} label={modalidadCfg.label} /> : '—'}
          </Dato>
          <Dato label="Confirmaciones">
            Donante {donacion.confirmadaDonanteEn ? `✓ ${formatFecha(donacion.confirmadaDonanteEn.slice(0, 10))}` : '—'}
            {' · '}
            Referente {donacion.confirmadaReferenteEn ? `✓ ${formatFecha(donacion.confirmadaReferenteEn.slice(0, 10))}` : '—'}
          </Dato>
          <Dato label="Ofrecida">{formatFecha(donacion.fechaOferta)}</Dato>
          {donacion.overrideEn && (
            <div>
              <Text variant="label" color="ink-3" as="div">Última vez forzada por un admin</Text>
              <Text variant="body-sm" color="ink-2" as="div">
                Admin #{donacion.overrideAdminId} — {formatFecha(donacion.overrideEn.slice(0, 10))}
              </Text>
              {donacion.overrideMotivo && (
                <Text variant="body-sm" color="ink-3" as="div" style={{ marginTop: 2 }}>
                  Motivo: {donacion.overrideMotivo}
                </Text>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select
            id={`override-estado-${donacion.id}`}
            label="Nuevo estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            {OVERRIDE_TARGET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Text variant="label">Motivo *</Text>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              rows={4}
              style={{
                resize: 'vertical',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                fontSize: 'var(--fs-body)',
                fontFamily: 'inherit',
              }}
            />
          </label>
          {override.isError && (
            <Text variant="micro" color="urgent">
              No se pudo forzar el estado. Verificá que la donación no esté en un estado terminal.
            </Text>
          )}
        </div>
      )}
    </Drawer>
  );
}

export default function ControlDonacionesPage() {
  const [page, setPage] = useState(0);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [soloEstancadas, setSoloEstancadas] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Debounce the free-text search into the server `q` param; reset to page 0
  // whenever the debounced value actually changes.
  useEffect(() => {
    const handle = setTimeout(() => {
      setQ(qInput.trim());
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [qInput]);

  function handleEstadoChange(value: string) {
    setEstado(value);
    setPage(0);
  }

  function toggleEstancadas() {
    setSoloEstancadas((prev) => !prev);
    setPage(0);
  }

  const { data, isLoading, isError, isFetching } = useDonacionesActivas({
    page,
    size: pageSize,
    q: q || undefined,
    estado: estado || undefined,
    estancadas: soloEstancadas || undefined,
  });
  usePageClamp(page, setPage, data?.totalPages);

  const donaciones = data?.content ?? [];
  const selected = donaciones.find((d) => d.id === selectedId) ?? null;

  const columns: Column<DonacionActiva>[] = [
    { key: 'id', header: '#', render: (d) => <Text variant="body-sm" color="ink-3">{d.id}</Text> },
    { key: 'donante', header: 'Donante', render: (d) => <Text variant="body">{d.donanteNombre ?? '—'}</Text> },
    { key: 'organizacion', header: 'Organización', render: (d) => <Text variant="body-sm">{d.organizacionNombre ?? '—'}</Text> },
    {
      key: 'necesidad',
      header: 'Necesidad',
      render: (d) => (
        <Text variant="body-sm" color="ink-3">
          {d.necesidadDescripcion && d.necesidadDescripcion.length > 60
            ? `${d.necesidadDescripcion.slice(0, 60)}…`
            : (d.necesidadDescripcion ?? '—')}
        </Text>
      ),
    },
    {
      key: 'modalidad',
      header: 'Modalidad',
      render: (d) => {
        const cfg = d.modalidad ? (MODALIDAD_DONACION[d.modalidad] ?? FALLBACK_BADGE) : undefined;
        return cfg ? <Badge tone={cfg.tone} label={cfg.label} /> : <Text variant="body-sm" color="ink-3">—</Text>;
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (d) => {
        const cfg = ESTADO_DONACION[d.estado as EstadoDonacion] ?? FALLBACK_BADGE;
        // Only EN_FONDO/ASIGNADA carry fase-specific copy not already covered by `estado`
        // (both still report `estado: OFRECIDA`) — any other fase would just repeat the estado badge.
        const faseCfg = d.fase ? FASE_DONACION[d.fase] : undefined;
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge tone={cfg.tone} label={cfg.label} />
            {faseCfg && <Badge tone={faseCfg.tone} label={faseCfg.label} />}
            {d.overrideEn && <Badge tone="danger" label="Forzada" />}
            {d.estancada && (
              <Badge tone="danger" label={`Estancada (${d.diasEnEstado ?? 0} ${d.diasEnEstado === 1 ? 'día' : 'días'})`} />
            )}
          </div>
        );
      },
    },
    {
      key: 'confirmaciones',
      header: 'Confirmaciones',
      render: (d) => (
        <Text variant="body-sm" color="ink-3">
          D {d.confirmadaDonanteEn ? '✓' : '—'} / R {d.confirmadaReferenteEn ? '✓' : '—'}
        </Text>
      ),
    },
    { key: 'ofrecida', header: 'Ofrecida', render: (d) => <Text variant="body-sm" color="ink-3">{formatFecha(d.fechaOferta)}</Text> },
    {
      key: 'lineas',
      header: 'Artículos',
      render: (d) => <Text variant="body-sm" color="ink-3">{formatLineas(d.lineas)}</Text>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Control de donaciones"
        description="Seguí y controlá el estado de todas las donaciones de la plataforma."
      />

      <AsyncSection isLoading={isLoading} isError={isError} isEmpty={false}>
        <div style={{ marginTop: 20 }}>
          <PaginatedTable
            columns={columns}
            rows={donaciones}
            rowKey={(d) => d.id}
            page={data ?? { number: 0, size: pageSize, totalElements: 0, totalPages: 0 }}
            onPageChange={setPage}
            isFetching={isFetching}
            search={{ value: qInput, onChange: setQInput, placeholder: 'Buscar por org, donante, necesidad o #id' }}
            toolbar={
              <>
                <Dropdown
                  value={estado}
                  onChange={handleEstadoChange}
                  options={ESTADO_FILTER_OPTIONS}
                  style={{ minWidth: 200 }}
                />
                <Button
                  variant={soloEstancadas ? 'danger' : 'secondary'}
                  size="sm"
                  aria-pressed={soloEstancadas}
                  onClick={toggleEstancadas}
                >
                  Solo estancadas
                </Button>
              </>
            }
            emptyLabel={q || estado || soloEstancadas ? 'No hay donaciones que coincidan con la búsqueda' : 'No hay donaciones activas'}
            onRowClick={(d) => setSelectedId(d.id)}
            selectedKey={selectedId ?? undefined}
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(0); }}
          />
        </div>
      </AsyncSection>

      {selected && <DonacionDrawer key={selected.id} donacion={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
