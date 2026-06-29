'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchNormal1, ArrowRight } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { MapDynamic, type MapMarkerData } from "@/components/ui/map-dynamic";
import { Avatar } from "@/components/ui/avatar";
import { Location, Routing } from "iconsax-reactjs";
import type { OrganizacionResponse } from "@/lib/api/organizaciones";
import { TIPO_ORGANIZACION_LABELS, TIPO_ORGANIZACION_OPTIONS, type TipoOrganizacion } from "@/lib/tipos-organizacion";
import { useValidatedOrganizaciones } from "@/lib/hooks/useValidatedOrganizaciones";
import { useGeolocation } from "@/hooks/useGeolocation";
import { sortByDistance, formatDistance } from "@/lib/geo";
import { OrgCardSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? "";

const FILTER_OPTIONS = [
  { label: "Todos", value: "" },
  ...TIPO_ORGANIZACION_OPTIONS,
];

type OrgWithDistance = OrganizacionResponse & { distanceKm?: number };

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
    <Link
      id={`org-card-${org.id}`}
      href={`/org/${org.slug}`}
      onMouseEnter={onHover}
      style={{ textDecoration: "none", color: "inherit", flexShrink: 0, scrollSnapAlign: "start" }}
    >
    <Card
      style={{
        width: 290,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: "pointer",
        transition: "box-shadow .15s, outline-color .15s",
        outline: selected ? "2px solid var(--sun)" : "2px solid transparent",
        boxShadow: selected ? "var(--sh-2)" : undefined,
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        <Avatar name={org.nombre} size={54} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{org.nombre}</h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 5,
              color: "var(--ink-2)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <Location size={14} color="var(--ink-3)" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {org.direccion ?? "Córdoba"}
            </span>
            {org.distanceKm != null && (
              <span style={{ color: "var(--horn)", fontWeight: 800, flexShrink: 0 }}>
                · {formatDistance(org.distanceKm)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Pill variant="cat">{TIPO_ORGANIZACION_LABELS[org.tipo as TipoOrganizacion] ?? org.tipo}</Pill>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <Button variant="primary" size="sm" style={{ gap: 6 }}>
          <Routing size={15} color="#fff" />
          Cómo llegar
        </Button>
      </div>
    </Card>
    </Link>
  );
}

export default function HomePage() {
  // Teaser: first 6 orgs for the home map view. Full list is at /organizaciones.
  const { data: orgsPage, isPending, isError, refetch } = useValidatedOrganizaciones(0, 6);
  const orgs = orgsPage?.content;
  const { position, hasUserPosition, fixCount, request } = useGeolocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [query, setQuery] = useState("");

  // Orgs ordenadas por cercanía a la ubicación (usuario o centro de Córdoba).
  const sortedOrgs = useMemo<OrgWithDistance[]>(
    () => (orgs ? sortByDistance(orgs, position) : []),
    [orgs, position],
  );

  // Filtrado por tipo de organización + búsqueda por nombre.
  const visibleOrgs = useMemo<OrgWithDistance[]>(() => {
    const q = query.trim().toLowerCase();
    return sortedOrgs.filter(
      (o) =>
        (activeFilter === "" || o.tipo === activeFilter) &&
        (q === "" || o.nombre.toLowerCase().includes(q)),
    );
  }, [sortedOrgs, activeFilter, query]);

  // Solo las que tienen coordenadas válidas van al mapa.
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
          banner: o.bannerKey ? `${BFF}/images?key=${o.bannerKey}` : undefined,
        })),
    [visibleOrgs],
  );

  function selectOrg(id: number) {
    setSelectedId(id);
    document
      .getElementById(`org-card-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar active="Mapa" />

      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <MapDynamic
          markers={markers}
          center={position}
          zoom={13}
          fitToMarkers
          userPosition={hasUserPosition ? position : null}
          selectedId={selectedId}
          onMarkerSelect={(id) => selectOrg(id as number)}
          recenterSignal={fixCount}
        />

        {/* floating search + filters */}
        <div
          className="w-[calc(100%-32px)] sm:w-[min(760px,70%)] flex flex-col gap-3"
          style={{
            position: "absolute",
            top: 22,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
          }}
        >
          <Card
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "6px 6px 6px 18px",
              boxShadow: "var(--sh-2)",
            }}
          >
            <SearchNormal1 size={20} color="var(--ink-3)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar organización por nombre…"
              style={{
                border: "none",
                padding: "12px 0",
                flex: 1,
                background: "transparent",
                fontWeight: 600,
                fontFamily: "inherit",
                fontSize: 14.5,
                color: "var(--ink)",
                outline: "none",
              }}
            />
            <Button variant="primary" size="sm">Buscar</Button>
          </Card>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FILTER_OPTIONS.map(({ label, value }) => {
              const isActive = value === activeFilter;
              return (
                <span
                  key={value}
                  onClick={() => setActiveFilter(value)}
                  style={{
                    padding: "9px 15px",
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    background: isActive ? "var(--earth)" : "var(--card)",
                    color: isActive ? "#fff" : "var(--ink-2)",
                    boxShadow: isActive ? "none" : "var(--sh-1)",
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {/* map controls */}
        <div
          style={{
            position: "absolute",
            right: 22,
            top: 100,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 1000,
          }}
        >
          <button
            title="Centrar en mi ubicación"
            onClick={() => request()}
            style={{
              width: 44,
              height: 44,
              border: "none",
              background: "var(--card)",
              borderRadius: "var(--r-card)",
              boxShadow: "var(--sh-1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Location size={20} color="var(--earth)" variant={hasUserPosition ? "Bold" : "Linear"} />
          </button>
        </div>

        {/* bottom sheet */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--adobe)",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            boxShadow: "0 -8px 30px rgba(122,42,8,.12)",
            padding: "14px 28px 22px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: 48,
              height: 5,
              borderRadius: 999,
              background: "var(--line)",
              margin: "0 auto 14px",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <h2 style={{ fontSize: 19, fontWeight: 900 }}>
              Cerca tuyo
              {!isPending && visibleOrgs.length > 0 && (
                <>
                  {" "}·{" "}
                  <span style={{ color: "var(--horn)" }}>{visibleOrgs.length} lugares</span>
                </>
              )}
            </h2>
            <a
              href="/organizaciones"
              style={{
                fontSize: 14,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "var(--sky)",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Ver lista completa{" "}
              <ArrowRight size={15} color="var(--sky)" />
            </a>
          </div>
          <div className="scrollbar-none" style={{ display: "flex", gap: 16, overflowX: "auto", scrollSnapType: "x mandatory", padding: "10px 20px 14px" }}>
            {isPending ? (
              Array.from({ length: 3 }, (_, i) => <OrgCardSkeleton key={i} />)
            ) : isError ? (
              <ErrorState
                onRetry={() => refetch()}
                message="No pudimos cargar los lugares. Intentá de nuevo."
              />
            ) : visibleOrgs.length === 0 ? (
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
    </div>
  );
}
