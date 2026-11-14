import { useState } from 'react';
import { AsyncSection } from '../AsyncSection';
import { Badge } from '../Badge';
import { Card } from '../ui/Card';
import { Drawer } from '../ui/Drawer';
import { Text } from '../ui/Typography';
import { DesgloseScore } from '../donacion/DesgloseScore';
import { useAsignacionesRonda } from '../../lib/hooks/useRondas';
import { ESTADO_ASIGNACION, ESTADO_RONDA, FALLBACK_BADGE, ORIGEN_RONDA } from '../../lib/domain-ui';
import { formatDecimal, formatFechaHora } from '../../lib/format';
import type { AsignacionRonda, RondaResponse } from '../../types/domain';

type RondaTab = 'asignaciones' | 'resumen';

const TABS = [
  { id: 'asignaciones', label: 'Asignaciones' },
  { id: 'resumen', label: 'Resumen' },
];

const PESOS: { key: keyof RondaResponse; label: string }[] = [
  { key: 'pesoDeficit', label: 'Déficit de cobertura' },
  { key: 'pesoUrgencia', label: 'Urgencia' },
  { key: 'pesoProximidad', label: 'Proximidad' },
  { key: 'pesoEspera', label: 'Tiempo de espera' },
  { key: 'pesoCumplimiento', label: 'Cumplimiento histórico' },
];

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text variant="label" color="ink-3" as="div">{label}</Text>
      <Text variant="body" as="div">{children}</Text>
    </div>
  );
}

/** Human duration between two ISO instants ("5 s", "2 min 3 s"); "—" when the ronda has not finished. */
function duracion(desde: string, hasta: string | null): string {
  if (!hasta) return '—';
  const seg = Math.max(0, Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 1000));
  if (Number.isNaN(seg)) return '—';
  return seg < 60 ? `${seg} s` : `${Math.floor(seg / 60)} min ${seg % 60} s`;
}

function AsignacionItem({ item }: { item: AsignacionRonda }) {
  const [open, setOpen] = useState(false);
  const a = item.asignacion;
  const estado = ESTADO_ASIGNACION[a.estado] ?? FALLBACK_BADGE;

  return (
    <Card as="article" className="list-card">
      <div className="list-card__body">
        <Text variant="title" as="h3">
          {item.donacionDescripcion || `Donación #${item.donacionId}`} → {a.organizacionNombre}
        </Text>
        {item.necesidadDescripcion && (
          <Text variant="body-sm" color="ink-3" as="p">{item.necesidadDescripcion}</Text>
        )}
        <div className="list-card__meta">
          <Badge tone={estado.tone} label={estado.label} />
          <Text variant="body-sm" as="span">Puntaje {formatDecimal(a.score)}</Text>
          <Text variant="body-sm" color="ink-3" as="span">{formatDecimal(a.distanciaKm)} km</Text>
        </div>
        <button
          type="button"
          className="list-card__toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Ocultar desglose' : 'Ver desglose'}
        </button>
        {open && <DesgloseScore asignacion={a} />}
      </div>
    </Card>
  );
}

function Asignaciones({ rondaId }: { rondaId: number }) {
  const q = useAsignacionesRonda(rondaId);
  const items = q.data ?? [];

  return (
    <AsyncSection
      isLoading={q.isLoading}
      isError={q.isError}
      isEmpty={items.length === 0}
      emptyLabel="Esta ronda no generó asignaciones."
      onRetry={() => { void q.refetch(); }}
    >
      <div className="stack">
        {items.map((it) => <AsignacionItem key={it.asignacion.id} item={it} />)}
      </div>
    </AsyncSection>
  );
}

function Resumen({ ronda: r }: { ronda: RondaResponse }) {
  const pesos = PESOS.flatMap(({ key, label }) => {
    const v = r[key];
    return typeof v === 'number' ? [{ key, label, valor: v }] : [];
  });

  return (
    <div className="stack">
      {r.estado === 'FALLIDA' && r.error && (
        <div className="banner-bad" role="alert"><Text variant="body-sm" as="p">{r.error}</Text></div>
      )}
      <div className="kv-grid">
        <Dato label="Ejecutada">{formatFechaHora(r.ejecutadaEn)}</Dato>
        <Dato label="Finalizada">{r.finalizadaEn ? formatFechaHora(r.finalizadaEn) : '—'}</Dato>
        <Dato label="Duración">{duracion(r.ejecutadaEn, r.finalizadaEn)}</Dato>
        <Dato label="Origen">{(ORIGEN_RONDA[r.origen] ?? FALLBACK_BADGE).label}</Dato>
        <Dato label="Ejecutada por">
          {r.origen === 'AUTOMATICA' ? 'Automática' : (r.ejecutadaPorNombre ?? `Admin #${r.ejecutadaPor}`)}
        </Dato>
        <Dato label="Donaciones consideradas">{r.donacionesConsideradas}</Dato>
        <Dato label="Candidatos considerados">{r.candidatosConsiderados}</Dato>
        <Dato label="Asignadas">{r.asignadas}</Dato>
        <Dato label="Sin asignar">{r.sinAsignar}</Dato>
        <Dato label="Descartadas">{r.descartadas}</Dato>
        <Dato label="Puntaje total">{r.scoreTotal != null ? formatDecimal(r.scoreTotal) : '—'}</Dato>
      </div>

      {pesos.length > 0 && (
        <Card as="section" className="card-pad">
          <Text variant="h3" as="h3">Pesos aplicados</Text>
          <Text variant="body-sm" color="ink-3" as="p">Cuánto pesó cada criterio en esta ronda.</Text>
          <div>
            {pesos.map((p) => (
              <div key={p.key} className="score-bar">
                <div className="score-bar__head">
                  <Text variant="label" color="ink" as="span">{p.label}</Text>
                  <Text variant="label" as="span">{Math.round(p.valor * 100)}%</Text>
                </div>
                <div role="img" aria-label={`${p.label}: ${Math.round(p.valor * 100)}%`} className="score-bar__track">
                  <div className="score-bar__fill" style={{ width: `${Math.max(0, Math.min(1, p.valor)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/** Detail of one ronda: the assignments it produced and its summary with the weights it applied. */
export function RondaDrawer({ ronda, onClose }: { ronda: RondaResponse; onClose: () => void }) {
  const [tab, setTab] = useState<RondaTab>('asignaciones');
  const estado = ESTADO_RONDA[ronda.estado] ?? FALLBACK_BADGE;

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`Ronda #${ronda.id}`}
      title={formatFechaHora(ronda.ejecutadaEn)}
      status={<Badge tone={estado.tone} label={estado.label} />}
      tabs={TABS}
      activeTab={tab}
      onTabChange={(id) => setTab(id as RondaTab)}
    >
      {tab === 'asignaciones' ? <Asignaciones rondaId={ronda.id} /> : <Resumen ronda={ronda} />}
    </Drawer>
  );
}
