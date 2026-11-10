import { useEffect, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Dropdown } from '../components/ui/Dropdown';
import { Input } from '../components/ui/Input';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { PageHeader } from '../components/ui/PageHeader';
import { Text } from '../components/ui/Typography';
import { OrgReferenteDrawer, UNASSIGNED_VALUE } from '../components/org/OrgReferenteDrawer';
import type { OrgDrawerTab } from '../components/org/OrgReferenteDrawer';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { useOrganizacionesAdmin } from '../lib/hooks/useOrganizacionesAdmin';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { useAsignarReferente } from '../lib/hooks/useAsignarReferente';
import { ESTADO_ORGANIZACION, TIPO_ORGANIZACION } from '../lib/domain-ui';
import type { OrganizacionAdmin, Usuario } from '../types/domain';

type Bandeja = 'rev' | 'sin' | 'todas';
/** A bandeja, or the id of a referente used as a filter. */
type View = Bandeja | number;

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
/** The MS caps a page at 100: enough referentes for the rail and the assignment dropdowns. */
const REFERENTES_SIZE = 100;

const ESTADO_DOT: Record<string, string> = {
  PENDIENTE: 'var(--sky)',
  APROBADA: 'var(--ok)',
  RECHAZADA: 'var(--urgent)',
  SIN_RECLAMAR: 'var(--sun)',
  INACTIVA: 'var(--gray-tx)',
};

const BANDEJAS: { id: Bandeja; label: string; dot: string }[] = [
  { id: 'rev', label: 'Por revisar', dot: 'var(--sky)' },
  { id: 'sin', label: 'Sin referente', dot: 'var(--urgent)' },
  { id: 'todas', label: 'Todas', dot: 'var(--sun)' },
];

const BANDEJA_TITLES: Record<Bandeja, [string, string]> = {
  rev: ['Por revisar', 'Altas pendientes de validación'],
  sin: ['Sin referente', 'Seleccioná varias para asignarlas de una vez'],
  todas: ['Todas las organizaciones', 'Vista completa'],
};

const initials = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

function Dot({ color }: { color: string }) {
  return <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: color, display: 'inline-block', flex: 'none' }} />;
}

interface RailItemProps {
  current: boolean;
  onClick: () => void;
  lead: React.ReactNode;
  label: string;
  sub?: string;
  count?: number;
}

function RailItem({ current, onClick, lead, label, sub, count }: RailItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? 'page' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '8px 10px',
        border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        fontSize: 'var(--fs-body-sm)', fontWeight: current ? 800 : 600,
        background: current ? 'var(--card-2)' : 'transparent',
        color: current ? 'var(--earth)' : 'var(--ink)',
      }}
    >
      {lead}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {sub && (
          <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sub}
          </span>
        )}
      </span>
      {count != null && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{count}</span>}
    </button>
  );
}

const RAIL_HEADING: React.CSSProperties = {
  textTransform: 'uppercase', letterSpacing: '.05em', padding: '8px 10px 4px', margin: 0, display: 'block',
};

export default function ReferentesPage() {
  const [view, setView] = useState<View>('rev');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [refInput, setRefInput] = useState('');
  const [refQ, setRefQ] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkRef, setBulkRef] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState<{ org: OrganizacionAdmin; tab: OrgDrawerTab } | null>(null);
  const asignar = useAsignarReferente();

  // Debounce both searches into their server `q` param; back to the first page when it changes.
  useEffect(() => {
    const handle = setTimeout(() => { setQ(qInput.trim()); setPage(0); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [qInput]);
  useEffect(() => {
    const handle = setTimeout(() => setRefQ(refInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [refInput]);

  // Rail: referentes (searchable) and, separately, the active ones for the assignment dropdowns.
  const railQuery = useUsuarios({ page: 0, size: REFERENTES_SIZE, tipo: 'REFERENTE', q: refQ });
  const activosQuery = useUsuarios({ page: 0, size: REFERENTES_SIZE, tipo: 'REFERENTE', activo: true });
  const referentesRail = railQuery.data?.content ?? [];
  const referentesActivos: Usuario[] = activosQuery.data?.content ?? [];

  // Bandeja counts: cheap size=1 queries read for `totalElements` only.
  const revCount = useOrganizacionesPendientes({ page: 0, size: 1 });
  const sinCount = useOrganizacionesAdmin({ page: 0, size: 1, sinReferente: true });
  const todasCount = useOrganizacionesAdmin({ page: 0, size: 1 });
  const counts: Record<Bandeja, number | undefined> = {
    rev: revCount.data?.totalElements,
    sin: sinCount.data?.totalElements,
    todas: todasCount.data?.totalElements,
  };

  // The table's data source depends on the view; only one of the two queries is enabled.
  const isRev = view === 'rev';
  const pendientes = useOrganizacionesPendientes({ page, size: pageSize }, { enabled: isRev });
  const adminParams = {
    page,
    size: pageSize,
    ...(view === 'sin' ? { sinReferente: true } : {}),
    ...(typeof view === 'number' ? { referenteIds: [view] } : {}),
    q,
  };
  const admin = useOrganizacionesAdmin(adminParams, { enabled: !isRev });
  const list = isRev ? pendientes : admin;
  usePageClamp(page, setPage, list.data?.totalPages);
  const rows = list.data?.content ?? [];

  function goTo(next: View) {
    setView(next);
    setPage(0);
    setSelected(new Set());
    setBulkRef('');
    setNotice('');
  }

  const [title, subtitle] = typeof view === 'number'
    ? (() => {
        const r = [...referentesRail, ...referentesActivos].find((u) => u.id === view);
        return [r?.nombre ?? 'Referente', r?.email ?? ''];
      })()
    : BANDEJA_TITLES[view];

  const allSelected = rows.length > 0 && rows.every((o) => selected.has(o.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const o of rows) {
        if (allSelected) next.delete(o.id);
        else next.add(o.id);
      }
      return next;
    });
  }

  async function applyBulk() {
    if (!bulkRef) return;
    const referenteId = bulkRef === UNASSIGNED_VALUE ? null : Number(bulkRef);
    const ids = [...selected];
    setBulkBusy(true);
    setNotice('');
    const failed = new Set<number>();
    // No bulk endpoint: one assignment per organization, sequentially so a failure is attributable.
    for (const organizacionId of ids) {
      try {
        await asignar.mutateAsync({ organizacionId, referenteId });
      } catch {
        failed.add(organizacionId);
      }
    }
    setBulkBusy(false);
    setSelected(failed);
    if (failed.size === 0) setBulkRef('');
    const done = ids.length - failed.size;
    setNotice(
      failed.size === 0
        ? `${done} ${done === 1 ? 'organización actualizada' : 'organizaciones actualizadas'}`
        : `${done} de ${ids.length} actualizadas · ${failed.size} fallaron y quedan seleccionadas para reintentar`,
    );
  }

  const columns: Column<OrganizacionAdmin>[] = [
    {
      key: 'org',
      header: 'Organización',
      render: (o) => (
        <div>
          <button
            type="button"
            onClick={() => setOpen({ org: o, tab: o.infoPublicaPendienteEn != null && isRev ? 'info' : 'asignacion' })}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 700, textAlign: 'left', color: 'var(--ink)' }}
          >
            {o.nombre}
          </button>
          <Text variant="micro" color="ink-3" as="span" style={{ display: 'block', marginTop: 2 }}>
            {TIPO_ORGANIZACION[o.tipo]?.label ?? o.tipo}{o.direccion ? ` · ${o.direccion}` : ''}
          </Text>
        </div>
      ),
    },
    {
      key: 'referente',
      header: 'Referente',
      render: (o) => o.referenteId == null
        ? <Text variant="body-sm" color="urgent">Sin asignar</Text>
        : <Text variant="body-sm">{o.referenteNombre ?? referentesRail.find((r) => r.id === o.referenteId)?.nombre ?? `#${o.referenteId}`}</Text>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (o) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <Dot color={ESTADO_DOT[o.estado] ?? 'var(--gray-tx)'} />
          <Text variant="body-sm" as="span" style={{ fontWeight: 700 }}>{(ESTADO_ORGANIZACION[o.estado] ?? { label: o.estado }).label}</Text>
          {o.infoPublicaPendienteEn != null && <Badge tone="sky" label="Info pública" />}
        </span>
      ),
    },
  ];

  const bulkBar = selected.size > 0 && (
    <div
      role="region"
      aria-label="Acciones masivas"
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 20px', background: 'var(--earth)', color: '#fff' }}
    >
      <strong style={{ flex: '1 1 180px', fontSize: 'var(--fs-body-sm)' }}>
        {selected.size} {selected.size === 1 ? 'organización seleccionada' : 'organizaciones seleccionadas'}
      </strong>
      <Dropdown
        value={bulkRef}
        disabled={bulkBusy}
        placeholder="Asignar a…"
        onChange={setBulkRef}
        options={[
          ...referentesActivos.map((r) => ({ value: String(r.id), label: `${r.nombre} (${r.email})` })),
          { value: UNASSIGNED_VALUE, label: 'Quitar referente' },
        ]}
      />
      <Button type="button" variant="secondary" size="sm" loading={bulkBusy} disabled={!bulkRef || bulkBusy}
        onClick={() => { void applyBulk(); }}>
        Aplicar
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={bulkBusy}
        style={{ color: '#fff', textDecoration: 'underline' }}
        onClick={() => { setSelected(new Set()); setBulkRef(''); }}>
        Quitar selección
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Referentes y organizaciones"
        description="Revisá solicitudes, asigná referentes y mantené al día la info pública de cada organización."
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <nav
          aria-label="Bandejas y referentes"
          style={{
            flex: '1 1 240px', maxWidth: 280, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column',
            gap: 2, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)',
          }}
        >
          <Text variant="caption" color="ink-2" style={RAIL_HEADING}>Bandejas</Text>
          {BANDEJAS.map((b) => (
            <RailItem
              key={b.id}
              current={view === b.id}
              onClick={() => goTo(b.id)}
              lead={<Dot color={b.dot} />}
              label={b.label}
              count={counts[b.id]}
            />
          ))}
          <div style={{ height: 1, background: 'var(--line)', margin: '8px 6px' }} />
          <Text variant="caption" color="ink-2" style={RAIL_HEADING}>Referentes</Text>
          <div style={{ padding: '0 4px 6px' }}>
            <Input
              type="search"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="Buscar referente"
              aria-label="Buscar referente"
            />
          </div>
          {railQuery.isError && <Text variant="body-sm" color="urgent" style={{ padding: '0 10px' }}>No se pudieron cargar los referentes.</Text>}
          {!railQuery.isLoading && !railQuery.isError && referentesRail.length === 0 && (
            <Text variant="body-sm" color="ink-3" style={{ padding: '0 10px' }}>
              {refQ ? 'Ningún referente coincide con la búsqueda.' : 'No hay referentes.'}
            </Text>
          )}
          <div style={{ maxHeight: 'min(50vh, 440px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {referentesRail.map((r) => (
              <RailItem
                key={r.id}
                current={view === r.id}
                onClick={() => goTo(r.id)}
                lead={(
                  <span
                    aria-hidden="true"
                    style={{
                      width: 28, height: 28, flex: 'none', borderRadius: 99, background: 'var(--horn)', color: '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                    }}
                  >
                    {initials(r.nombre)}
                  </span>
                )}
                label={r.nombre}
                sub={r.activo ? r.email : `${r.email} · Inactivo`}
              />
            ))}
          </div>
        </nav>

        <section style={{ flex: '999 1 640px', minWidth: 0 }}>
          <div style={{ marginBottom: 12 }}>
            <Text variant="h3" as="h2">{title}</Text>
            {subtitle && <Text variant="body-sm" color="ink-3" style={{ display: 'block' }}>{subtitle}</Text>}
          </div>
          {notice && <Text variant="body-sm" color="ink-2" role="status" style={{ display: 'block', marginBottom: 8 }}>{notice}</Text>}

          <PaginatedTable
            columns={columns}
            rows={rows}
            rowKey={(o) => o.id}
            isLoading={list.isLoading}
            isError={list.isError}
            onRetry={() => { void list.refetch(); }}
            emptyLabel={q ? 'No hay organizaciones que coincidan con la búsqueda.' : 'No hay organizaciones en esta bandeja.'}
            page={list.data ?? { number: 0, size: pageSize, totalElements: 0, totalPages: 0 }}
            onPageChange={setPage}
            isFetching={list.isFetching}
            // The pendientes endpoint has no name filter, so the search only exists on the other views.
            search={isRev ? undefined : { value: qInput, onChange: setQInput, placeholder: 'Buscar por nombre o barrio' }}
            onRowClick={(o) => setOpen({ org: o, tab: o.infoPublicaPendienteEn != null && isRev ? 'info' : 'asignacion' })}
            selectedKey={open?.org.id}
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(0); }}
            selection={{
              isSelected: (o) => selected.has(o.id),
              onToggle: (o) => setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(o.id)) next.delete(o.id);
                else next.add(o.id);
                return next;
              }),
              onToggleAll: toggleAll,
              allSelected,
              selectAllLabel: 'Seleccionar página',
              rowLabel: (o) => `Seleccionar ${o.nombre}`,
            }}
            banner={bulkBar || undefined}
          />
        </section>
      </div>

      {open && (
        <OrgReferenteDrawer
          key={open.org.id}
          org={open.org}
          initialTab={open.tab}
          referentesActivos={referentesActivos}
          onClose={() => setOpen(null)}
          onOrgChange={(org) => setOpen((cur) => (cur ? { ...cur, org } : cur))}
        />
      )}
    </div>
  );
}
