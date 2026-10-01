import { useEffect, useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Dropdown } from '../components/ui/Dropdown';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { Text } from '../components/ui/Typography';
import { useDonacionesActivas } from '../lib/hooks/useDonacionesActivas';
import { useOverrideEstadoDonacion } from '../lib/hooks/useOverrideEstadoDonacion';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { ESTADO_DONACION, FALLBACK_BADGE, MODALIDAD_DONACION, FASE_DONACION } from '../lib/domain-ui';
import { formatFecha } from '../lib/format';
import type { DonacionActiva, EstadoDonacion } from '../types/domain';

const PAGE_SIZE = 20;
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

interface OverrideFormProps {
  donacion: DonacionActiva;
  onDone: () => void;
}

function OverrideForm({ donacion, onDone }: OverrideFormProps) {
  const [estado, setEstado] = useState<string>(donacion.estado);
  const [motivo, setMotivo] = useState('');
  const override = useOverrideEstadoDonacion();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!motivo.trim()) return;
    try {
      await override.mutateAsync({ id: donacion.id, estado, motivo: motivo.trim() });
      onDone();
    } catch (err) {
      void err;
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
      <Text variant="label">Forzar estado</Text>
      <Dropdown value={estado} onChange={setEstado} options={OVERRIDE_TARGET_OPTIONS} />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text variant="label">Motivo *</Text>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={500}
          rows={3}
          required
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
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" variant="danger" size="sm" loading={override.isPending} disabled={!motivo.trim()}>
          Forzar estado
        </Button>
      </div>
    </form>
  );
}

interface RowDetailProps {
  donacion: DonacionActiva;
  onDone: () => void;
}

function RowDetail({ donacion, onDone }: RowDetailProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {donacion.overrideEn && (
        <div>
          <Text variant="label" style={{ display: 'block', marginBottom: 4 }}>
            Última vez forzada por un admin
          </Text>
          <Text variant="body-sm" color="ink-2">
            Admin #{donacion.overrideAdminId} — {formatFecha(donacion.overrideEn?.slice(0, 10))}
          </Text>
          {donacion.overrideMotivo && (
            <Text variant="body-sm" color="ink-3" style={{ display: 'block', marginTop: 2 }}>
              Motivo: {donacion.overrideMotivo}
            </Text>
          )}
        </div>
      )}
      <OverrideForm donacion={donacion} onDone={onDone} />
    </div>
  );
}

export default function ControlDonacionesPage() {
  const [page, setPage] = useState(0);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { data, isLoading, isError, isFetching } = useDonacionesActivas({
    page,
    size: PAGE_SIZE,
    q: q || undefined,
    estado: estado || undefined,
  });
  usePageClamp(page, setPage, data?.totalPages);

  const donaciones = data?.content ?? [];

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
  ];

  return (
    <div>
      <Text variant="h1">Control de donaciones</Text>

      <AsyncSection isLoading={isLoading} isError={isError} isEmpty={false}>
        <div style={{ marginTop: 20 }}>
          <PaginatedTable
            columns={columns}
            rows={donaciones}
            rowKey={(d) => d.id}
            page={data ?? { number: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 }}
            onPageChange={setPage}
            isFetching={isFetching}
            search={{ value: qInput, onChange: setQInput, placeholder: 'Buscar por org, donante, necesidad o #id' }}
            toolbar={
              <Dropdown
                value={estado}
                onChange={handleEstadoChange}
                options={ESTADO_FILTER_OPTIONS}
                style={{ minWidth: 200 }}
              />
            }
            emptyLabel={q || estado ? 'No hay donaciones que coincidan con la búsqueda' : 'No hay donaciones activas'}
            rowActions={(d) => (
              <Button variant="secondary" size="sm" onClick={() => toggle(d.id)}>
                {expanded.has(d.id) ? 'Cerrar' : 'Forzar estado'}
              </Button>
            )}
            expandedKeys={expanded}
            renderRowDetail={(d) => <RowDetail donacion={d} onDone={() => toggle(d.id)} />}
          />
        </div>
      </AsyncSection>
    </div>
  );
}
