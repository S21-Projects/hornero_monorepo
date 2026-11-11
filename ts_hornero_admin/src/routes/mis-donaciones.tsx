import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMisDonaciones } from '../lib/hooks/useMisDonaciones';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { ESTADO_DONACION, FALLBACK_BADGE, MODALIDAD_DONACION } from '../lib/domain-ui';
import { esTerminal, faseDe, proximoPaso, puedeCancelar, puedeConfirmar, titularDonacion } from '../lib/donacion-donante';
import { formatFecha, formatLineas } from '../lib/format';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { BarraProgreso } from '../components/donacion/BarraProgreso';
import { useCancelarConConfirmacion } from '../components/donacion/useCancelarConConfirmacion';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { OverflowMenu, type OverflowMenuItem } from '../components/ui/OverflowMenu';
import { Pager } from '../components/ui/Pager';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import type { Donacion } from '../types/domain';

const PAGE_SIZE = 20;

type Tab = 'activas' | 'historial';

interface DonacionRowProps {
  donacion: Donacion;
}

function DonacionRow({ donacion: d }: DonacionRowProps) {
  const estadoCfg = ESTADO_DONACION[d.estado] ?? FALLBACK_BADGE;
  const modalidadCfg = d.modalidad ? (MODALIDAD_DONACION[d.modalidad] ?? FALLBACK_BADGE) : undefined;
  const cancelar = useCancelarConConfirmacion(d.id);

  const canConfirm = puedeConfirmar(d);
  const lineas = d.lineas && d.lineas.length > 0 ? formatLineas(d.lineas) : `Donación #${d.id}`;
  const menu: OverflowMenuItem[] = [{ label: 'Ver detalle', to: `/mis-donaciones/${d.id}` }];
  if (puedeCancelar(d)) {
    menu.push({ label: 'Cancelar donación…', onSelect: cancelar.pedir, danger: true, disabled: cancelar.isPending });
  }

  return (
    <Card as="article" className={`list-card${canConfirm ? ' list-card--accent' : ''}`}>
      <div className="list-card__body">
        <div className="list-card__badges">
          <Badge tone={estadoCfg.tone} label={estadoCfg.label} />
          {modalidadCfg && <Badge tone={modalidadCfg.tone} label={modalidadCfg.label} />}
          <Text variant="caption" color="ink-3">
            #{d.id}
            {d.fechaOferta ? ` · ofrecida el ${formatFecha(d.fechaOferta)}` : ''}
          </Text>
        </div>

        {/* FONDO_COMUN starts with no destination until a ronda assigns it — headline is then
            just the articles, never assuming an organization is set. */}
        <Text variant="title" as="h3">{titularDonacion(lineas, d.organizacionNombre)}</Text>

        <BarraProgreso fase={faseDe(d)} />

        <Text variant="body-sm" color="ink-2">{proximoPaso(d).texto}</Text>

        {d.observaciones && <Text variant="caption" color="ink-3">{d.observaciones}</Text>}

        {cancelar.isError && (
          <Text variant="micro" color="urgent">No se pudo cancelar la donación. Intentá de nuevo.</Text>
        )}
      </div>

      <div className="list-card__actions">
        {canConfirm ? (
          <Link to={`/donaciones/${d.id}/entrega`} style={{ textDecoration: 'none' }}>
            <Button type="button" variant="ok" size="sm">Confirmar entrega</Button>
          </Link>
        ) : (
          <Link to={`/mis-donaciones/${d.id}`} style={{ textDecoration: 'none' }}>
            <Button type="button" variant="secondary" size="sm">Ver detalle</Button>
          </Link>
        )}
        <OverflowMenu items={menu} />
      </div>

      {cancelar.dialogo}
    </Card>
  );
}

interface StatCardProps {
  value: number;
  label: string;
  accent?: boolean;
}

function StatCard({ value, label, accent }: StatCardProps) {
  return (
    <Card className={`stat-card${accent && value > 0 ? ' stat-card--accent' : ''}`}>
      <Text variant="stat" as="p">{value}</Text>
      <Text variant="label" color="ink-2" as="p">{label}</Text>
    </Card>
  );
}

export default function MisDonacionesPage() {
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<Tab>('activas');
  const { data, isLoading, isError, isFetching } = useMisDonaciones({ page, size: PAGE_SIZE });
  usePageClamp(page, setPage, data?.totalPages);
  const donaciones = data?.content ?? [];

  // The endpoint is paginated server-side: every count below covers only the loaded page, so the
  // UI says so whenever there is more than one page instead of showing a misleading total.
  const parcial = (data?.totalPages ?? 1) > 1;
  const activas = donaciones.filter((d) => !esTerminal(d));
  const historial = donaciones.filter(esTerminal);
  const visibles = tab === 'activas' ? activas : historial;
  const teTocaActuar = donaciones.filter(puedeConfirmar).length;
  const entregadas = donaciones.filter((d) => d.estado === 'ENTREGADA').length;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'activas', label: 'Activas', count: activas.length },
    { id: 'historial', label: 'Historial', count: historial.length },
  ];

  return (
    <div>
      <PageHeader
        title="Mis donaciones"
        description="Seguí cada donación hasta que llegue a destino."
        actions={
          <Link to="/donar" style={{ textDecoration: 'none' }}>
            <Button type="button" size="sm">+ Nueva donación</Button>
          </Link>
        }
      />

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        isEmpty={!isLoading && !isError && donaciones.length === 0}
        emptyLabel="Aún no realizaste donaciones."
      >
        <div className="stat-grid">
          <StatCard value={teTocaActuar} label="Te toca actuar" accent />
          <StatCard value={activas.length} label="En curso" />
          <StatCard value={entregadas} label="Entregadas" />
        </div>
        {parcial && (
          <Text variant="caption" color="ink-3" as="p" style={{ marginBottom: 12 }}>
            Los totales y las pestañas cuentan solo las donaciones de esta página.
          </Text>
        )}

        <div role="tablist" aria-label="Estado de las donaciones" className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              className="tabs__tab"
              onClick={() => setTab(t.id)}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack">
          {visibles.length === 0 ? (
            <Text variant="body-sm" color="ink-3" as="p">
              {tab === 'activas' ? 'No tenés donaciones en curso.' : 'Todavía no hay donaciones cerradas.'}
            </Text>
          ) : (
            visibles.map((d) => <DonacionRow key={d.id} donacion={d} />)
          )}
        </div>

        {data && <Pager page={data} onPageChange={setPage} disabled={isFetching} />}
      </AsyncSection>
    </div>
  );
}
