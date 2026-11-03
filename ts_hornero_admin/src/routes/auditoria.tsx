import { useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Dropdown } from '../components/ui/Dropdown';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { AuditQueue } from '../components/acreditacion/AuditQueue';
import { useColaAuditoria } from '../lib/hooks/useColaAuditoria';
import { requisitoLabel } from '../lib/acreditacion';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { NivelAcreditacion, RequisitoAcreditacion, TipoEvidencia } from '../types/domain';
import type {
  EstadoRequisitoLegajo,
  EvidenciaEnColaResponse,
  RequisitoEnLegajo,
  TabCola,
} from '../types/domain';

const PAGE_SIZE = 20;

const NIVEL_OPTIONS = [
  { value: '', label: 'Todos los niveles' },
  ...Object.values(NivelAcreditacion).map((n) => ({ value: n, label: n })),
];
const REQUISITO_OPTIONS = [
  { value: '', label: 'Todos los requisitos' },
  ...Object.values(RequisitoAcreditacion).map((r) => ({ value: r, label: requisitoLabel(r) })),
];
const TIPO_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  ...Object.values(TipoEvidencia).map((t) => ({ value: t, label: t })),
];

/**
 * AD-8 (task 4b.4): builds the single-row `RequisitoEnLegajo` shape `AuditQueue` expects, so the
 * cross-org queue's detail panel reuses it unmodified instead of duplicating Aprobar/Observar.
 * The estado cast is safe: the queue query never returns `REEMPLAZADA` rows (design AD-8), and
 * every other `EstadoEvidencia` value is also a valid `EstadoRequisitoLegajo`.
 */
function toRequisitoEnLegajo(row: EvidenciaEnColaResponse): RequisitoEnLegajo {
  return {
    requisito: row.requisito,
    nivelExigido: row.nivelExigido,
    estado: row.estado as EstadoRequisitoLegajo,
    tipoEvidencia: row.tipoEvidencia,
    declaracion: row.declaracion,
    validoDesde: row.validoDesde,
    validoHasta: row.validoHasta,
    expirada: row.expirada,
    objectKey: row.objectKey,
  };
}

/** Cross-org audit queue screen (AD-8, `specs/auditoria-cola-global/spec.md`), ADMINISTRADOR-only. */
export default function AuditoriaPage() {
  const [tab, setTab] = useState<TabCola>('PENDIENTES');
  const [nivel, setNivel] = useState('');
  const [requisito, setRequisito] = useState('');
  const [tipoEvidencia, setTipoEvidencia] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filters = {
    nivel: (nivel || undefined) as NivelAcreditacion | undefined,
    requisito: (requisito || undefined) as RequisitoAcreditacion | undefined,
    tipoEvidencia: (tipoEvidencia || undefined) as TipoEvidencia | undefined,
  };

  const cola = useColaAuditoria({ tab, page, size: PAGE_SIZE, ...filters });
  // Tab badge counts (mockup "Pendientes · N / Vencidas · N") — the endpoint has no combined
  // count, so the inactive tab's total is fetched separately with size=1 (row payload unused).
  const pendientesCount = useColaAuditoria({ tab: 'PENDIENTES', page: 0, size: 1, ...filters });
  const vencidasCount = useColaAuditoria({ tab: 'VENCIDAS', page: 0, size: 1, ...filters });

  usePageClamp(page, setPage, cola.data?.totalPages);

  const rows = cola.data?.content ?? [];

  function changeTab(next: TabCola) {
    setTab(next);
    setPage(0);
    setSelectedId(null);
  }

  function changeFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(0);
  }

  const columns: Column<EvidenciaEnColaResponse>[] = [
    {
      key: 'organizacion',
      header: 'Organización',
      render: (r) => <Text variant="body">{r.organizacionNombre}</Text>,
    },
    {
      key: 'requisito',
      header: 'Requisito',
      render: (r) => <Text variant="body-sm">{requisitoLabel(r.requisito)}</Text>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (r) => <Text variant="body-sm" color="ink-3">{r.tipoEvidencia}</Text>,
    },
    {
      key: 'nivel',
      header: 'Nivel',
      render: (r) => <Badge tone="neutral" label={r.nivelExigido} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Cola de auditoría"
        description="Evidencia de acreditación pendiente de revisión en todas las organizaciones."
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          type="button"
          variant={tab === 'PENDIENTES' ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={tab === 'PENDIENTES'}
          onClick={() => changeTab('PENDIENTES')}
        >
          Pendientes · {pendientesCount.data?.totalElements ?? 0}
        </Button>
        <Button
          type="button"
          variant={tab === 'VENCIDAS' ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={tab === 'VENCIDAS'}
          onClick={() => changeTab('VENCIDAS')}
        >
          Vencidas · {vencidasCount.data?.totalElements ?? 0}
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <Dropdown
          value={nivel}
          onChange={(v) => changeFilter(setNivel, v)}
          options={NIVEL_OPTIONS}
          style={{ minWidth: 200 }}
        />
        <Dropdown
          value={requisito}
          onChange={(v) => changeFilter(setRequisito, v)}
          options={REQUISITO_OPTIONS}
          style={{ minWidth: 220 }}
        />
        <Dropdown
          value={tipoEvidencia}
          onChange={(v) => changeFilter(setTipoEvidencia, v)}
          options={TIPO_OPTIONS}
          style={{ minWidth: 200 }}
        />
      </div>

      <AsyncSection
        isLoading={cola.isLoading}
        isError={cola.isError}
        isEmpty={rows.length === 0}
        emptyLabel={
          tab === 'PENDIENTES' ? 'No hay evidencia pendiente de auditoría' : 'No hay evidencia vencida'
        }
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
            renderRowDetail={(r) => (
              <AuditQueue
                organizacionId={r.organizacionId}
                requisitos={[toRequisitoEnLegajo(r)]}
                evidenciaIds={{ [r.requisito]: r.id }}
                evidenciaObjectKeys={{ [r.requisito]: r.objectKey }}
              />
            )}
          />
        </div>
      </AsyncSection>
    </div>
  );
}
