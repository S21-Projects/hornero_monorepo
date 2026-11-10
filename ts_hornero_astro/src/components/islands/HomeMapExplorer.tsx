import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchNormal1, ArrowRight, Location, Routing, Gps } from 'iconsax-reactjs';
import { Card } from '../ui/card';
import { Pill } from '../ui/pill';
import { Button } from '../ui/button';
import { Avatar } from '../ui/avatar';
import { EmptyState } from '../ui/empty-state';
import LeafletMap, { type MapMarkerData, type MapViewport } from './leaflet-map';
import { TIPO_ORGANIZACION_LABELS, TIPO_ORGANIZACION_OPTIONS, type TipoOrganizacion } from '../../lib/tipos-organizacion';
import { sortByDistance, formatDistance, CORDOBA_CENTER } from '../../lib/geo';
import { useGeolocation } from '../../lib/useGeolocation';
import { boundsKey, fetchZona, snapBounds, type ZonaResult } from '../../lib/mapaZona';
import type { Org } from '../../lib/types';

const FILTER_OPTIONS = [
  { label: 'Todos', value: '' },
  ...TIPO_ORGANIZACION_OPTIONS,
];

type OrgWithDistance = Org & { distanceKm?: number };

/** Unclaimed orgs span the whole country: cap how many cards hit the DOM (the map still shows all). */
const SIN_RECLAMAR_LIST_CAP = 30;

/**
 * Below this zoom the viewport covers more than ~40 km across, which would always hit the
 * server's 500-pin cap: skip the request and ask the visitor to zoom in instead.
 */
const MIN_ZOOM_SIN_RECLAMAR = 11;
const ZONA_DEBOUNCE_MS = 300;
const ZONA_CACHE_MAX = 40;

const PUBLIC_BFF_URL = import.meta.env.PUBLIC_BFF_URL ?? '';
const PUBLIC_SPA_URL = import.meta.env.PUBLIC_SPA_URL ?? '';

function OrgCard({
  org,
  selected,
  onHover,
}: {
  org: OrgWithDistance;
  selected: boolean;
  onHover: () => void;
}) {
  return (
    <a
      id={`org-card-${org.id}`}
      href={`/org/${org.slug}`}
      onMouseEnter={onHover}
      style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0, scrollSnapAlign: 'start' }}
    >
      <Card
        className="flex w-[78vw] max-w-[290px] cursor-pointer flex-col gap-3 p-4 sm:w-[290px]"
        style={{
          transition: 'box-shadow .15s, outline-color .15s',
          outline: selected ? '2px solid var(--sun)' : '2px solid transparent',
          boxShadow: selected ? 'var(--sh-2)' : undefined,
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          <Avatar name={org.nombre} size={54} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{org.nombre}</h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 5,
                color: 'var(--ink-2)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Location size={14} color="var(--ink-3)" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {org.direccion ?? (org.estado === 'SIN_RECLAMAR' ? 'Sin dirección registrada' : 'Córdoba')}
              </span>
              {org.distanceKm != null && (
                <span style={{ color: 'var(--horn)', fontWeight: 800, flexShrink: 0 }}>
                  · {formatDistance(org.distanceKm)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Pill variant="cat">{TIPO_ORGANIZACION_LABELS[org.tipo as TipoOrganizacion] ?? org.tipo}</Pill>
          {org.estado === 'SIN_RECLAMAR' && <Pill variant="closed">Sin reclamar</Pill>}
          {org.aceptaDonaciones && <Pill variant="ghost">Recibe donaciones</Pill>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Button variant="primary" size="sm" style={{ gap: 6 }}>
            <Routing size={15} color="#fff" />
            Cómo llegar
          </Button>
        </div>
      </Card>
    </a>
  );
}

interface HomeMapExplorerProps {
  orgs: Org[];
}

export default function HomeMapExplorer({ orgs }: HomeMapExplorerProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [query, setQuery] = useState('');
  const [showSinReclamar, setShowSinReclamar] = useState(false);

  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [zona, setZona] = useState<ZonaResult>({ orgs: [], truncated: false });
  const [zonaLoading, setZonaLoading] = useState(false);
  const [zonaError, setZonaError] = useState(false);
  const zonaCache = useRef(new Map<string, ZonaResult>());

  const geo = useGeolocation();
  // Distances are measured from the visitor once located, otherwise from Córdoba.
  const origin = geo.hasUserPosition ? geo.position : CORDOBA_CENTER;

  const zoomTooLow = viewport != null && viewport.zoom < MIN_ZOOM_SIN_RECLAMAR;

  // Fetch unclaimed pins for the visible box: debounced, stale requests aborted, small cache.
  useEffect(() => {
    if (!showSinReclamar || viewport == null || zoomTooLow) {
      setZonaLoading(false);
      return;
    }
    const box = snapBounds(viewport);
    const key = boundsKey(box);
    const cached = zonaCache.current.get(key);
    if (cached) {
      setZona(cached);
      setZonaError(false);
      setZonaLoading(false);
      return;
    }

    const controller = new AbortController();
    setZonaLoading(true);
    const timer = setTimeout(() => {
      fetchZona(box, controller.signal)
        .then((result) => {
          if (zonaCache.current.size >= ZONA_CACHE_MAX) {
            zonaCache.current.delete(zonaCache.current.keys().next().value as string);
          }
          zonaCache.current.set(key, result);
          setZona(result);
          setZonaError(false);
          setZonaLoading(false);
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          console.error(e);
          setZonaError(true);
          setZonaLoading(false);
        });
    }, ZONA_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [showSinReclamar, viewport, zoomTooLow]);

  const sortedOrgs = useMemo<OrgWithDistance[]>(() => sortByDistance(orgs, origin), [orgs, origin]);
  const sortedSinReclamar = useMemo<OrgWithDistance[]>(() => {
    const verifiedIds = new Set(orgs.map((o) => o.id));
    return sortByDistance(
      zona.orgs.filter((o) => !verifiedIds.has(o.id)),
      origin,
    );
  }, [zona, orgs, origin]);

  const visibleOrgs = useMemo<OrgWithDistance[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (o: OrgWithDistance) =>
      (activeFilter === '' || o.tipo === activeFilter) &&
      (q === '' || o.nombre.toLowerCase().includes(q));
    // Verified orgs always come first so unclaimed ones never push them out of the list.
    return [
      ...sortedOrgs.filter(matches),
      ...(showSinReclamar ? sortedSinReclamar.filter(matches) : []),
    ];
  }, [sortedOrgs, sortedSinReclamar, showSinReclamar, activeFilter, query]);

  const listedOrgs = useMemo<OrgWithDistance[]>(() => {
    let unclaimed = 0;
    return visibleOrgs.filter((o) => o.estado !== 'SIN_RECLAMAR' || ++unclaimed <= SIN_RECLAMAR_LIST_CAP);
  }, [visibleOrgs]);

  const markers = useMemo<MapMarkerData[]>(
    () =>
      visibleOrgs
        .filter((o) => o.latitud != null && o.longitud != null)
        .map((o) => ({
          id: o.id,
          lat: o.latitud as number,
          lng: o.longitud as number,
          label: o.nombre,
          sub: o.direccion,
          unclaimed: o.estado === 'SIN_RECLAMAR',
          banner: o.bannerKey ? `${PUBLIC_BFF_URL}/images?key=${o.bannerKey}` : undefined,
        })),
    [visibleOrgs],
  );

  function selectOrg(id: number) {
    setSelectedId(id);
    document
      .getElementById(`org-card-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  const statusMessages = [
    showSinReclamar && zoomTooLow && 'Acercá el mapa para ver las organizaciones sin reclamar',
    showSinReclamar && !zoomTooLow && zonaLoading && 'Buscando organizaciones sin reclamar…',
    showSinReclamar && !zoomTooLow && zonaError && 'No pudimos cargar las organizaciones sin reclamar. Probá mover el mapa para reintentar.',
    showSinReclamar && !zoomTooLow && !zonaLoading && !zonaError && zona.truncated &&
      'Hay más organizaciones en esta zona: acercá el mapa para verlas todas',
    geo.status === 'denied' && 'No pudimos acceder a tu ubicación. Revisá los permisos del navegador.',
    geo.status === 'unsupported' && 'Tu navegador no permite obtener la ubicación.',
  ].filter((m): m is string => typeof m === 'string');

  return (
    <div className="flex h-[calc(100dvh-60px)] flex-col">
      <div className="relative flex-1 overflow-hidden">
        <LeafletMap
          markers={markers}
          center={origin}
          zoom={13}
          fitToMarkers
          clusterMarkers
          userPosition={geo.hasUserPosition ? geo.position : null}
          recenterSignal={geo.fixCount}
          onViewportChange={setViewport}
          selectedId={selectedId}
          onMarkerSelect={(id) => selectOrg(id as number)}
        />

        {/* floating search + filters */}
        <div
          className="w-[calc(100%-32px)] sm:w-[min(760px,70%)] flex flex-col gap-3"
          style={{
            position: 'absolute',
            top: 22,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          <Card
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '6px 6px 6px 18px',
              boxShadow: 'var(--sh-2)',
            }}
          >
            <SearchNormal1 size={20} color="var(--ink-3)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar organización por nombre…"
              style={{
                border: 'none',
                padding: '12px 0',
                flex: 1,
                background: 'transparent',
                fontWeight: 600,
                fontFamily: 'inherit',
                fontSize: 14.5,
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
            <Button variant="primary" size="sm">Buscar</Button>
          </Card>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FILTER_OPTIONS.map(({ label, value }) => {
              const isActive = value === activeFilter;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveFilter(value)}
                  className="cursor-pointer border-0 bg-transparent p-0"
                  style={{
                    padding: '9px 15px',
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: 13,
                    background: isActive ? 'var(--earth)' : 'var(--card)',
                    color: isActive ? '#fff' : 'var(--ink-2)',
                    boxShadow: isActive ? 'none' : 'var(--sh-1)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          <button
              type="button"
              aria-pressed={showSinReclamar}
              onClick={() => setShowSinReclamar((v) => !v)}
              className="cursor-pointer border-0 bg-transparent p-0"
              style={{
                padding: '9px 15px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 13,
                background: showSinReclamar ? 'var(--earth)' : 'var(--card)',
                color: showSinReclamar ? '#fff' : 'var(--ink-2)',
                boxShadow: showSinReclamar ? 'none' : 'var(--sh-1)',
              }}
            >
              Sin reclamar
            </button>
            <button
              type="button"
              aria-label="Usar mi ubicación"
              disabled={geo.status === 'requesting'}
              onClick={() => geo.request()}
              className="cursor-pointer border-0 bg-transparent p-0"
              style={{
                padding: '9px 15px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: geo.hasUserPosition ? 'var(--earth)' : 'var(--card)',
                color: geo.hasUserPosition ? '#fff' : 'var(--ink-2)',
                boxShadow: geo.hasUserPosition ? 'none' : 'var(--sh-1)',
              }}
            >
              <Gps size={16} color={geo.hasUserPosition ? '#fff' : 'var(--ink-2)'} />
              {geo.status === 'requesting' ? 'Buscando…' : 'Mi ubicación'}
            </button>
          </div>

          {statusMessages.length > 0 && (
            <div role="status" className="flex flex-col items-start gap-1.5">
              {statusMessages.map((m) => (
                <span
                  key={m}
                  className="rounded-[var(--r-pill)] bg-[var(--card)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]"
                  style={{ boxShadow: 'var(--sh-1)' }}
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* bottom sheet */}
        <div
          className="absolute bottom-0 left-0 right-0 z-[1000] px-4 pb-5 pt-3.5 sm:px-7"
          style={{
            background: 'var(--adobe)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            boxShadow: '0 -8px 30px rgba(122,42,8,.12)',
          }}
        >
          <div
            style={{
              width: 48,
              height: 5,
              borderRadius: 999,
              background: 'var(--line)',
              margin: '0 auto 14px',
            }}
          />
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black sm:text-[19px]">
              Cerca tuyo
              {visibleOrgs.length > 0 && (
                <>
                  {' '}·{' '}
                  <span style={{ color: 'var(--horn)' }}>{visibleOrgs.length} lugares</span>
                </>
              )}
            </h2>
            <a
              href="/organizaciones"
              style={{
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--sky)',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Ver lista completa{' '}
              <ArrowRight size={15} color="var(--sky)" />
            </a>
          </div>
          {listedOrgs.length < visibleOrgs.length && (
            <p className="mb-2 text-[12.5px] font-bold text-[var(--ink-3)]">
              Mostrando las {SIN_RECLAMAR_LIST_CAP} organizaciones sin reclamar más cercanas. Todas se ven en el mapa.
            </p>
          )}
          <div
            className="scrollbar-none flex gap-4 overflow-x-auto px-3 pb-3.5 pt-2.5 sm:px-5"
            style={{
              scrollSnapType: 'x mandatory',
            }}
          >
            {visibleOrgs.length === 0 ? (
              <EmptyState variant="no-comedores" />
            ) : (
              listedOrgs.map((org) => (
                <OrgCard
                  key={org.id}
                  org={org}
                  selected={org.id === selectedId}
                  onHover={() => setSelectedId(org.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* CTA to full SPA for donations */}
      {/* <div style={{ textAlign: 'center', padding: '10px 0 6px', fontSize: 13, color: 'var(--ink-3)' }}>
        ¿Querés donar?{' '}
        <a href={`${PUBLIC_SPA_URL}/donaciones`} style={{ color: 'var(--sky)', fontWeight: 700 }}>
          Ingresá a la plataforma
        </a>
      </div> */}
    </div>
  );
}
