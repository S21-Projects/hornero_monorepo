import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { OrgMapa } from '../../lib/types';
import { Text } from '../ui/typography';
import { isApiEnvelope } from '../../lib/publicFetch';
import {
  BREAKS,
  COLORS,
  NULL_FILL,
  NULL_STROKE,
  fmtInt,
  fmtRatio,
  type DepartamentoProps,
} from '../../lib/vulnerabilidad';
import type { DepartamentoCollection, Layers } from './MapaVulnerabilidadMap';

// Leaflet touches `window` at import time, so the map is only loaded in the browser.
const MapaMap = lazy(() => import('./MapaVulnerabilidadMap'));

const PUBLIC_BFF_URL = import.meta.env.PUBLIC_BFF_URL ?? '';

interface Props {
  /** Departamentos without comedores / total, computed on the server from the static GeoJSON. */
  sinComedores: number;
  totalDepartamentos: number;
}

type PinsState = 'loading' | 'ok' | 'error';
type GeoState = 'loading' | 'ok' | 'error';

function LayerChip({ label, on, onToggle, swatch, count }: {
  label: string;
  on: boolean;
  onToggle: () => void;
  swatch: React.ReactNode;
  count?: number;
}) {
  return (
    <li>
      <button type="button" aria-pressed={on} onClick={onToggle} className={`mapa-chip${on ? ' mapa-chip--on' : ''}`}>
        {swatch}
        <span>{label}</span>
        {count != null && <span className="mapa-chip__count">{fmtInt(count)}</span>}
      </button>
    </li>
  );
}

export default function MapaVulnerabilidad({ sinComedores, totalDepartamentos }: Props) {
  const [layers, setLayers] = useState<Layers>({
    vulnerabilidad: true,
    densidad: false,
    plataforma: true,
    sinReclamar: true,
  });
  const [geo, setGeo] = useState<DepartamentoCollection | null>(null);
  const [geoState, setGeoState] = useState<GeoState>('loading');
  const [pins, setPins] = useState<OrgMapa[]>([]);
  const [pinsState, setPinsState] = useState<PinsState>('loading');
  const [selected, setSelected] = useState<DepartamentoProps | null>(null);
  const [focus, setFocus] = useState<{ codigo: string; n: number } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/mapa/departamentos.geojson', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((g: DepartamentoCollection) => {
        setGeo(g);
        setGeoState('ok');
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setGeoState('error');
      });
    fetch(`${PUBLIC_BFF_URL}/organizaciones/mapa`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: unknown) => {
        const rows = (isApiEnvelope(body) ? body.data : body) as OrgMapa[];
        if (!Array.isArray(rows)) throw new Error('unexpected body');
        setPins(rows.filter((o) => Number.isFinite(o.latitud) && Number.isFinite(o.longitud)));
        setPinsState('ok');
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setPinsState('error');
      });
    return () => ctrl.abort();
  }, []);

  const toggle = (k: keyof Layers) => () => setLayers((l) => ({ ...l, [k]: !l[k] }));

  // Counts only once the pins have loaded; no extra fetches.
  const counts = useMemo(() => {
    if (pinsState !== 'ok') return null;
    const plataforma = pins.filter((o) => o.origen === 'PLATAFORMA').length;
    return { plataforma, sinReclamar: pins.length - plataforma, total: pins.length };
  }, [pins, pinsState]);

  // Lower bound of each legend cell, derived from BREAKS: "<0,5×", "0,5×", ..., "4×+".
  const ticks = COLORS.map((_, i) => (i === 0 ? `<${fmtRatio(BREAKS[0])}×` : `${fmtRatio(BREAKS[i - 1])}×${i === COLORS.length - 1 ? '+' : ''}`));

  const options = useMemo(() => {
    if (!geo) return [];
    const byProv = new Map<string, DepartamentoProps[]>();
    for (const f of geo.features) {
      const p = f.properties;
      const prov = p.provincia ?? 'Sin provincia';
      byProv.set(prov, [...(byProv.get(prov) ?? []), p]);
    }
    return [...byProv.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([prov, deps]) => [prov, deps.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'))] as const);
  }, [geo]);

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-60px)] lg:flex-row">
      <aside aria-label="Controles y referencias del mapa" className="mapa-panel">
        <div className="flex flex-col gap-2">
          <Text as="h1" variant="h2">Mapa de vulnerabilidad</Text>
          <Text variant="body-sm" color="ink-2">
            Dónde hay más personas por comedor y más necesidades sin cubrir. Es el índice que usa Hornero para repartir el
            fondo común.
          </Text>
          <a href="#sobre-los-datos" className="mapa-link self-start" onClick={() => {
            const d = document.getElementById('sobre-los-datos');
            if (d instanceof HTMLDetailsElement) d.open = true;
          }}>
            ¿Cómo se calcula?
          </a>
        </div>

        <div>
          <label htmlFor="sel-depto" className="mapa-label">Ir a un departamento</label>
          <select
            id="sel-depto"
            disabled={geoState !== 'ok'}
            value={selected?.codigo ?? ''}
            onChange={(e) => {
              const codigo = e.target.value;
              const p = options.flatMap(([, d]) => d).find((d) => d.codigo === codigo) ?? null;
              setSelected(p);
              if (p) setFocus((f) => ({ codigo: p.codigo, n: (f?.n ?? 0) + 1 }));
            }}
            className="mapa-select"
          >
            <option value="">{geoState === 'ok' ? 'Elegí un departamento' : 'Cargando departamentos…'}</option>
            {options.map(([prov, deps]) => (
              <optgroup key={prov} label={prov}>
                {deps.map((d) => (
                  <option key={d.codigo} value={d.codigo}>
                    {d.nombre ?? `Departamento ${d.codigo}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <section aria-labelledby="capas-titulo">
          <h2 id="capas-titulo" className="mapa-label">Capas</h2>
          <ul className="mapa-chips">
            <LayerChip
              label="Vulnerabilidad"
              on={layers.vulnerabilidad}
              onToggle={toggle('vulnerabilidad')}
              swatch={
                <span aria-hidden="true" className="mapa-swatch-scale">
                  {COLORS.map((c) => (
                    <span key={c} style={{ background: c }} />
                  ))}
                </span>
              }
            />
            <LayerChip label="Densidad" on={layers.densidad} onToggle={toggle('densidad')} swatch={<span aria-hidden="true" className="mapa-dot mapa-dot--dens" />} count={counts?.total} />
            <LayerChip label="Organizaciones en Hornero" on={layers.plataforma} onToggle={toggle('plataforma')} swatch={<span aria-hidden="true" className="mapa-dot mapa-dot--plat" />} count={counts?.plataforma} />
            <LayerChip label="Comedores sin reclamar" on={layers.sinReclamar} onToggle={toggle('sinReclamar')} swatch={<span aria-hidden="true" className="mapa-dot mapa-dot--sin" />} count={counts?.sinReclamar} />
          </ul>
        </section>

        <section aria-labelledby="leyenda-titulo">
          <h2 id="leyenda-titulo" className="mapa-label">Veces la mediana del país</h2>
          <div className="mapa-legend__bar" aria-hidden="true">
            {COLORS.map((c) => (
              <span key={c} className="mapa-legend__cell" style={{ background: c }} />
            ))}
          </div>
          <ul className="mapa-legend__ticks">
            {ticks.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="mapa-legend__ends" aria-hidden="true">
            <span>Mejor cubierto</span>
            <span>Más vulnerable</span>
          </div>
          <div className="mapa-legend__null">
            <span
              aria-hidden="true"
              className="mapa-legend__null-swatch"
              style={{
                background: `repeating-linear-gradient(45deg, ${NULL_FILL}, ${NULL_FILL} 2px, #fff 2px, #fff 4px)`,
                border: `1px dashed ${NULL_STROKE}`,
              }}
            />
            Sin comedores en el registro
          </div>
        </section>

        <details id="sobre-los-datos" className="mapa-details">
          <summary>Sobre los datos</summary>
          <div className="mapa-details__body">
            <p>
              Datos del Registro Nacional de Comedores (ReNaCoM), el Censo 2022 y Hornero. El registro es una muestra:{' '}
              {fmtInt(sinComedores)} de {fmtInt(totalDepartamentos)} departamentos no tienen comedores cargados, y eso no
              significa que no haya necesidad.
            </p>
            <p>
              Las zonas con organizaciones de mayor nivel de acreditación pueden mostrar más necesidades, porque su tope de
              necesidades abiertas es más alto. El índice cuenta las necesidades tal como las declaran las organizaciones.
            </p>
            {/* CC-BY-4.0 requires crediting the census authors and naming the license (scripts/mapa/README.md). Keep this text and links. */}
            <p>
              Fuentes: Censo Nacional de Población, Hogares y Viviendas 2022 (INDEC), cartografía de radios de Rodriguez
              &amp; de Grande (CONICET), bajo licencia{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/deed.es" target="_blank" rel="noopener noreferrer">
                CC BY 4.0
              </a>
              ; Registro Nacional de Comedores y Merenderos (ReNaCoM), publicado por CONICET en su{' '}
              <a href="https://ri.conicet.gov.ar/handle/11336/278030" target="_blank" rel="noopener noreferrer">
                repositorio institucional
              </a>
              . Datos procesados por Hornero.
            </p>
          </div>
        </details>
      </aside>

      <div className="relative h-[70dvh] min-h-[420px] flex-1 bg-[var(--adobe)] lg:h-auto">
        {geoState === 'error' && (
          <div role="alert" className="absolute left-3 right-3 top-3 z-[1000] rounded-lg border border-[var(--line)] bg-[var(--bad-bg)] p-3 text-sm font-bold text-[var(--bad-tx)]">
            No pudimos cargar los datos de vulnerabilidad. Probá recargar la página.
          </div>
        )}
        {geoState === 'loading' && (
          <div role="status" className="absolute left-3 top-3 z-[1000] rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm font-bold text-[var(--ink-2)]">
            Cargando mapa…
          </div>
        )}
        {geoState !== 'error' && pinsState === 'error' && (
          <div role="status" className="absolute left-3 right-3 top-3 z-[1000] rounded-lg border border-[var(--line)] bg-[var(--medium-bg)] p-3 text-sm font-bold text-[var(--warn-tx)] sm:right-auto sm:max-w-sm">
            No pudimos cargar las organizaciones y comedores. La capa de vulnerabilidad sigue disponible.
          </div>
        )}
        {geoState === 'ok' && pinsState === 'loading' && (
          <div role="status" className="absolute right-3 top-3 z-[1000] rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-xs font-bold text-[var(--ink-2)]">
            Cargando organizaciones…
          </div>
        )}

        <Suspense fallback={null}>
          {typeof window !== 'undefined' && (
            <MapaMap
              departamentos={geo}
              pins={pins}
              layers={layers}
              selectedCodigo={selected?.codigo ?? null}
              focus={focus}
              onSelect={setSelected}
            />
          )}
        </Suspense>

        {selected && (
          <section aria-label="Detalle del departamento" className="mapa-depto-card">
            <div>
              <div className="mapa-depto-card__head">
                <div>
                  <div className="mapa-depto-card__eyebrow">Departamento</div>
                  <h2 className="mapa-depto-card__name">{selected.nombre ?? `Departamento ${selected.codigo}`}</h2>
                  {selected.provincia && <div className="mapa-depto-card__prov">{selected.provincia}</div>}
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar detalle" className="mapa-depto-card__close">
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              <p className="mapa-depto-card__ratio">
                {selected.vulnerabilidad == null ? (
                  'Sin comedores en el registro. No podemos estimar la cobertura.'
                ) : (
                  <>
                    <strong>{fmtRatio(selected.vulnerabilidad)}×</strong>
                    <span>personas por comedor que la mediana del país</span>
                  </>
                )}
              </p>
              <dl className="mapa-depto-card__stats">
                <div>
                  <dt>Habitantes (Censo 2022)</dt>
                  <dd>{fmtInt(selected.habitantes)}</dd>
                </div>
                <div>
                  <dt>Comedores registrados</dt>
                  <dd>{fmtInt(selected.comedores)}</dd>
                </div>
                <div>
                  <dt>Habitantes por comedor</dt>
                  <dd>{fmtInt(selected.habitantesPorComedor)}</dd>
                </div>
                <div>
                  <dt>Necesidades sin cubrir</dt>
                  <dd>{fmtInt(selected.necesidadesAbiertas)}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
