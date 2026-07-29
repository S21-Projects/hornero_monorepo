import { useMemo, useState } from 'react';
import { SearchNormal1, ArrowRight, Location, Routing } from 'iconsax-reactjs';
import { Card } from '../ui/card';
import { Pill } from '../ui/pill';
import { Button } from '../ui/button';
import { Avatar } from '../ui/avatar';
import { EmptyState } from '../ui/empty-state';
import LeafletMap, { type MapMarkerData } from './leaflet-map';
import { TIPO_ORGANIZACION_LABELS, TIPO_ORGANIZACION_OPTIONS, type TipoOrganizacion } from '../../lib/tipos-organizacion';
import { sortByDistance, formatDistance, CORDOBA_CENTER } from '../../lib/geo';
import type { Org } from '../../lib/types';

const FILTER_OPTIONS = [
  { label: 'Todos', value: '' },
  ...TIPO_ORGANIZACION_OPTIONS,
];

type OrgWithDistance = Org & { distanceKm?: number };

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
                {org.direccion ?? 'Córdoba'}
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

  // Sort by distance from Córdoba center (no geolocation in public-only slice 1).
  const sortedOrgs = useMemo<OrgWithDistance[]>(
    () => sortByDistance(orgs, CORDOBA_CENTER),
    [orgs],
  );

  const visibleOrgs = useMemo<OrgWithDistance[]>(() => {
    const q = query.trim().toLowerCase();
    return sortedOrgs.filter(
      (o) =>
        (activeFilter === '' || o.tipo === activeFilter) &&
        (q === '' || o.nombre.toLowerCase().includes(q)),
    );
  }, [sortedOrgs, activeFilter, query]);

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

  return (
    <div className="flex h-[calc(100dvh-60px)] flex-col">
      <div className="relative flex-1 overflow-hidden">
        <LeafletMap
          markers={markers}
          center={CORDOBA_CENTER}
          zoom={13}
          fitToMarkers
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
          </div>
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
          <div
            className="scrollbar-none flex gap-4 overflow-x-auto px-3 pb-3.5 pt-2.5 sm:px-5"
            style={{
              scrollSnapType: 'x mandatory',
            }}
          >
            {visibleOrgs.length === 0 ? (
              <EmptyState variant="no-comedores" />
            ) : (
              visibleOrgs.map((org) => (
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
