import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { OrgMapa } from '../../lib/types';
import { isApiEnvelope } from '../../lib/publicFetch';
import {
  BREAK_LABELS,
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

function Check({ id, label, checked, onChange, swatch }: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  swatch?: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 text-sm font-bold text-[var(--ink)] hover:bg-[var(--card-2)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--sky-tx)]"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 flex-shrink-0 accent-[var(--horn)]"
      />
      {swatch}
      <span>{label}</span>
    </label>
  );
}

function Dot({ filled }: { filled: boolean }) {
  return filled ? (
    <span aria-hidden="true" className="inline-block h-4 w-4 flex-shrink-0 rounded-full border-2 border-white bg-[var(--horn)] shadow-[0_0_0_1px_var(--line)]" />
  ) : (
    <span aria-hidden="true" className="inline-block h-3 w-3 flex-shrink-0 rounded-full border border-[var(--ink)] bg-white" />
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

  const set = (k: keyof Layers) => (v: boolean) => setLayers((l) => ({ ...l, [k]: v }));

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
      <aside
        aria-label="Controles y referencias del mapa"
        className="flex flex-col gap-5 border-b border-[var(--line)] bg-[var(--card)] p-4 sm:p-6 lg:w-[380px] lg:flex-shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r"
      >
        <div>
          <h1 className="m-0 text-2xl font-black text-[var(--earth)]">Mapa de vulnerabilidad</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--ink-2)]">
            Zonas con más personas por comedor y más necesidades sin cubrir. Es el mismo índice que usa Hornero para
            repartir las donaciones al fondo común.
          </p>
        </div>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Capas</legend>
          <Check id="capa-vuln" label="Vulnerabilidad por departamento" checked={layers.vulnerabilidad} onChange={set('vulnerabilidad')} />
          <Check id="capa-dens" label="Densidad de comedores" checked={layers.densidad} onChange={set('densidad')} />
          <Check id="capa-plat" label="Organizaciones en Hornero" checked={layers.plataforma} onChange={set('plataforma')} swatch={<Dot filled />} />
          <Check id="capa-sin" label="Comedores sin reclamar (ReNaCoM)" checked={layers.sinReclamar} onChange={set('sinReclamar')} swatch={<Dot filled={false} />} />
        </fieldset>

        <section aria-labelledby="leyenda-titulo">
          <h2 id="leyenda-titulo" className="m-0 mb-2 text-xs font-extrabold uppercase tracking-wide text-[var(--ink-3)]">
            Leyenda: veces la mediana del país
          </h2>
          <div className="flex overflow-hidden rounded-md border border-[var(--line)]" aria-hidden="true">
            {COLORS.map((c) => (
              <span key={c} className="h-3 flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs font-bold text-[var(--ink-2)]">
            <span>Mejor cubierto</span>
            <span>Mediana país (1.0)</span>
            <span>Más vulnerable</span>
          </div>
          <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-xs font-semibold text-[var(--ink-2)]">
            {COLORS.map((c, i) => (
              <li key={c} className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block h-3 w-3 flex-shrink-0 rounded-sm border border-[var(--line)]" style={{ background: c }} />
                {BREAK_LABELS[i]}
              </li>
            ))}
            <li className="col-span-2 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 flex-shrink-0 rounded-sm"
                style={{
                  background: `repeating-linear-gradient(45deg, ${NULL_FILL}, ${NULL_FILL} 2px, #fff 2px, #fff 4px)`,
                  border: `1px dashed ${NULL_STROKE}`,
                }}
              />
              Sin comedores en el registro
            </li>
          </ul>
        </section>

        {geoState === 'ok' && (
          <div>
            <label htmlFor="sel-depto" className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[var(--ink-3)]">
              Ir a un departamento
            </label>
            <select
              id="sel-depto"
              value={selected?.codigo ?? ''}
              onChange={(e) => {
                const codigo = e.target.value;
                const p = options.flatMap(([, d]) => d).find((d) => d.codigo === codigo) ?? null;
                setSelected(p);
                if (p) setFocus((f) => ({ codigo: p.codigo, n: (f?.n ?? 0) + 1 }));
              }}
              className="min-h-[44px] w-full rounded-[var(--r-input)] border border-[var(--line)] bg-white px-3 text-sm font-bold text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sky-tx)]"
            >
              <option value="">Elegí un departamento</option>
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
        )}

        <div className="flex flex-col gap-2 text-xs font-semibold leading-relaxed text-[var(--ink-2)]">
          <p className="m-0">
            Datos del Registro Nacional de Comedores (ReNaCoM), el Censo 2022 y Hornero. El registro es una muestra:{' '}
            {fmtInt(sinComedores)} de {fmtInt(totalDepartamentos)} departamentos no tienen comedores cargados, y eso no
            significa que no haya necesidad.
          </p>
          <p className="m-0">
            Las zonas con organizaciones de mayor nivel de acreditación pueden mostrar más necesidades, porque su tope de
            necesidades abiertas es más alto. El índice cuenta las necesidades tal como las declaran las organizaciones.
          </p>
        </div>
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
          <section
            aria-label="Detalle del departamento"
            className="absolute bottom-3 left-3 right-3 z-[1000] rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--card)] p-4 shadow-[var(--sh-pop)] sm:right-auto sm:w-[340px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="m-0 text-lg font-black text-[var(--earth)]">
                  {selected.nombre ?? `Departamento ${selected.codigo}`}
                </h2>
                {selected.provincia && <div className="text-sm font-bold text-[var(--ink-2)]">{selected.provincia}</div>}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Cerrar detalle"
                className="-mr-2 -mt-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-xl text-[var(--ink-2)] hover:bg-[var(--card-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sky-tx)]"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <p className="mb-3 mt-2 text-sm font-extrabold text-[var(--ink)]">
              {selected.vulnerabilidad == null
                ? 'Sin comedores en el registro. No podemos estimar la cobertura.'
                : `${fmtRatio(selected.vulnerabilidad)} veces la mediana del país`}
            </p>
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <dt className="font-semibold text-[var(--ink-2)]">Habitantes (Censo 2022)</dt>
              <dd className="m-0 text-right font-extrabold">{fmtInt(selected.habitantes)}</dd>
              <dt className="font-semibold text-[var(--ink-2)]">Comedores registrados</dt>
              <dd className="m-0 text-right font-extrabold">{fmtInt(selected.comedores)}</dd>
              <dt className="font-semibold text-[var(--ink-2)]">Habitantes por comedor</dt>
              <dd className="m-0 text-right font-extrabold">{fmtInt(selected.habitantesPorComedor)}</dd>
              <dt className="font-semibold text-[var(--ink-2)]">Necesidades sin cubrir</dt>
              <dd className="m-0 text-right font-extrabold">{fmtInt(selected.necesidadesAbiertas)}</dd>
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
