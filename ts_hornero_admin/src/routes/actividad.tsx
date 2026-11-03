import { useState } from 'react';
import { Badge } from '../components/Badge';
import { Dropdown } from '../components/ui/Dropdown';
import { Input } from '../components/ui/Input';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { useActividad } from '../lib/hooks/useActividad';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import {
  ACCION_ACTIVIDAD,
  ACTOR_ACTIVIDAD,
  ENTIDAD_ACTIVIDAD,
  FALLBACK_BADGE,
  RESULTADO_ACTIVIDAD,
  labelAccion,
} from '../lib/domain-ui';
import { formatFechaHora } from '../lib/format';
import type { Actividad } from '../types/domain';

const PAGE_SIZE = 10;

const ACCION_OPTIONS = [
  { value: '', label: 'Todas las acciones' },
  ...Object.entries(ACCION_ACTIVIDAD)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es')),
];

const RESULTADO_OPTIONS = [
  { value: '', label: 'Todos los resultados' },
  { value: 'EXITO', label: 'Éxito' },
  { value: 'FALLO', label: 'Fallo' },
];

// Argentina has no DST: UTC-3 all year, so a calendar day maps to a fixed UTC window.
const inicioDelDia = (d: string) => (d ? new Date(`${d}T00:00:00-03:00`).toISOString() : undefined);
const finDelDia = (d: string) => (d ? new Date(`${d}T23:59:59.999-03:00`).toISOString() : undefined);

export default function ActividadPage() {
  const [page, setPage] = useState(0);
  const [accion, setAccion] = useState('');
  const [resultado, setResultado] = useState('');
  const [usuario, setUsuario] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const usuarioId = Number(usuario);
  const { data, isLoading, isError, isFetching, refetch } = useActividad({
    page,
    size: PAGE_SIZE,
    actorUsuarioId: Number.isInteger(usuarioId) && usuarioId > 0 ? usuarioId : undefined,
    accion: accion || undefined,
    resultado: resultado || undefined,
    desde: inicioDelDia(desde),
    hasta: finDelDia(hasta),
  });
  usePageClamp(page, setPage, data?.totalPages);

  // Every filter change goes back to the first page.
  const filtro = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  const columns: Column<Actividad>[] = [
    {
      key: 'cuando',
      header: 'Fecha y hora',
      render: (a) => <Text variant="body-sm" color="ink-3">{formatFechaHora(a.ocurridoEn)}</Text>,
    },
    {
      key: 'accion',
      header: 'Acción',
      render: (a) => <Text variant="body">{labelAccion(a.accion)}</Text>,
    },
    {
      key: 'resultado',
      header: 'Resultado',
      render: (a) => {
        const cfg = RESULTADO_ACTIVIDAD[a.resultado] ?? FALLBACK_BADGE;
        return <Badge tone={cfg.tone} label={cfg.label} />;
      },
    },
    {
      key: 'actor',
      header: 'Usuario',
      render: (a) => {
        const tipo = ACTOR_ACTIVIDAD[a.actorTipo] ?? a.actorTipo;
        const idSufijo = a.actorUsuarioId != null ? ` #${a.actorUsuarioId}` : '';
        return (
          <div>
            {a.actorNombre ? (
              <>
                <Text variant="body-sm" style={{ display: 'block' }}>{a.actorNombre}</Text>
                {a.actorEmail && (
                  <Text variant="micro" color="ink-3" style={{ display: 'block' }}>{a.actorEmail}</Text>
                )}
                <Text variant="micro" color="ink-3" style={{ display: 'block' }}>
                  {tipo}{idSufijo}
                </Text>
              </>
            ) : (
              <Text variant="body-sm">{tipo}{idSufijo}</Text>
            )}
          {a.emailIntento && (
            <Text variant="micro" color="ink-3" style={{ display: 'block' }}>
              Intento con {a.emailIntento}
            </Text>
          )}
          </div>
        );
      },
    },
    {
      key: 'entidad',
      header: 'Entidad',
      render: (a) => (
        <Text variant="body-sm" color="ink-2">
          {a.entidadTipo
            ? `${ENTIDAD_ACTIVIDAD[a.entidadTipo] ?? a.entidadTipo}${a.entidadId != null ? ` #${a.entidadId}` : ''}`
            : '—'}
        </Text>
      ),
    },
    {
      key: 'detalle',
      header: 'Detalle',
      render: (a) => (
        <div>
          {a.detalle && <Text variant="body-sm" style={{ display: 'block' }}>{a.detalle}</Text>}
          {(a.antes || a.despues) && (
            <Text variant="body-sm" color="ink-2" style={{ display: 'block' }}>
              {a.antes ?? '—'} → {a.despues ?? '—'}
            </Text>
          )}
          {a.motivo && (
            <Text variant="micro" color="ink-3" style={{ display: 'block' }}>
              Motivo: {a.motivo}
            </Text>
          )}
          {!a.detalle && !a.antes && !a.despues && !a.motivo && (
            <Text variant="body-sm" color="ink-3">—</Text>
          )}
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (a) => <Text variant="body-sm" color="ink-3">{a.ip ?? '—'}</Text>,
    },
  ];

  const hayFiltros = Boolean(accion || resultado || usuario || desde || hasta);

  return (
    <div>
      <PageHeader
        title="Registro de actividades"
        description="Registro de solo lectura: no puede editarse ni borrarse desde la aplicación."
      />

      <>
        <div>
          <PaginatedTable
            columns={columns}
            rows={data?.content ?? []}
            rowKey={(a) => a.id}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => { void refetch(); }}
            page={data ?? { number: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 }}
            onPageChange={setPage}
            isFetching={isFetching}
            toolbar={
              <>
                <Dropdown value={accion} onChange={filtro(setAccion)} options={ACCION_OPTIONS} style={{ minWidth: 240 }} />
                <Dropdown value={resultado} onChange={filtro(setResultado)} options={RESULTADO_OPTIONS} />
                <Input
                  id="actividad-usuario"
                  label="Usuario (id)"
                  type="number"
                  min={1}
                  value={usuario}
                  onChange={(e) => filtro(setUsuario)(e.target.value)}
                  style={{ width: 130 }}
                />
                <Input
                  id="actividad-desde"
                  label="Desde"
                  type="date"
                  value={desde}
                  onChange={(e) => filtro(setDesde)(e.target.value)}
                />
                <Input
                  id="actividad-hasta"
                  label="Hasta"
                  type="date"
                  value={hasta}
                  onChange={(e) => filtro(setHasta)(e.target.value)}
                />
              </>
            }
            emptyLabel={
              hayFiltros
                ? 'No hay actividad que coincida con los filtros'
                : 'Todavía no hay actividad registrada'
            }
          />
        </div>
      </>
    </div>
  );
}
