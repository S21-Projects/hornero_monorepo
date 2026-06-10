'use client';

import Link from "next/link";
import { SearchNormal1, Add, ArrowRight } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Stars } from "@/components/ui/stars";
import { Button } from "@/components/ui/button";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import { Avatar } from "@/components/ui/avatar";
import { Location, Routing } from "iconsax-reactjs";
import type { OrganizacionResponse } from "@/lib/api/organizaciones";
import { useValidatedOrganizaciones } from "@/lib/hooks/useValidatedOrganizaciones";
import { OrgCardSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

const FILTERS = ["Todos", "Almuerzo", "Merienda", "Desayuno", "Donaciones", "Abierto ahora"];

const PINS = [
  { x: "28%", y: "34%", active: false, count: 3 },
  { x: "52%", y: "52%", active: true },
  { x: "68%", y: "30%", active: false },
  { x: "44%", y: "70%", active: false, count: 2 },
  { x: "78%", y: "62%", active: false },
];

function OrgCard({ org }: { org: OrganizacionResponse }) {
  return (
    <Link href={`/org/${org.slug}`} style={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}>
    <Card
      style={{
        width: 290,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: "pointer",
        transition: "box-shadow .15s",
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
            {org.direccion ?? "Córdoba"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Pill variant="cat">{org.tipo}</Pill>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stars value={5} />
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
  const { data: orgs, isPending, isError, refetch } = useValidatedOrganizaciones();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar active="Mapa" />

      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <MapPlaceholder pins={PINS} />

        {/* floating search + filters */}
        <div
          style={{
            position: "absolute",
            top: 22,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(760px, 70%)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            zIndex: 10,
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
              placeholder="Buscar comedores, merenderos o barrios en Córdoba…"
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
            {FILTERS.map((f, i) => (
              <span
                key={f}
                style={{
                  padding: "9px 15px",
                  borderRadius: 999,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  background: i === 0 ? "var(--earth)" : "var(--card)",
                  color: i === 0 ? "#fff" : "var(--ink-2)",
                  boxShadow: i === 0 ? "none" : "var(--sh-1)",
                }}
              >
                {f}
              </span>
            ))}
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
            zIndex: 10,
          }}
        >
          {[<Add key="add" size={20} color="var(--earth)" />, <Location key="loc" size={20} color="var(--earth)" />].map((icon, i) => (
            <button
              key={i}
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
              {icon}
            </button>
          ))}
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
            zIndex: 10,
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
              {!isPending && orgs && orgs.length > 0 && (
                <>
                  {" "}·{" "}
                  <span style={{ color: "var(--horn)" }}>{orgs.length} lugares</span>
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
          <div style={{ display: "flex", gap: 16, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 4, scrollbarWidth: "none" }}>
            {isPending ? (
              Array.from({ length: 3 }, (_, i) => <OrgCardSkeleton key={i} />)
            ) : isError ? (
              <ErrorState
                onRetry={() => refetch()}
                message="No pudimos cargar los lugares. Intentá de nuevo."
              />
            ) : !orgs || orgs.length === 0 ? (
              <EmptyState variant="no-comedores" />
            ) : (
              orgs.map((org) => <OrgCard key={org.id} org={org} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
