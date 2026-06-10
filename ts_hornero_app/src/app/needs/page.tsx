'use client';

import { Heart, Calendar } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { OrgCardSkeleton } from "@/components/ui/skeleton";
import { useNecesidades } from "@/lib/hooks/useNecesidades";
import { useValidatedOrganizaciones } from "@/lib/hooks/useValidatedOrganizaciones";
import { mapPrioridad, type NecesidadResponse } from "@/lib/api/donaciones.server";

const PRIORITY_LABEL = { urgent: "Urgente", medium: "Media", normal: "Normal" };
const URGENCY = ["Todas", "Urgente", "Media", "Normal"];

const ESTADO_VARIANT: Record<string, "ok" | "warn" | "ghost" | "bad"> = {
  ACTIVA: "ok",
  VENCIDA: "bad",
  INACTIVA: "ghost",
};

function NeedCard({ n, orgName }: { n: NecesidadResponse; orgName: string }) {
  const priority = mapPrioridad(n.prioridad);
  const estadoVariant = ESTADO_VARIANT[n.estado] ?? "ghost";
  const fechaLabel = n.fechaVencimiento
    ? new Date(n.fechaVencimiento).toLocaleDateString("es-AR")
    : null;

  return (
    <Card
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Pill variant={priority}>{PRIORITY_LABEL[priority]}</Pill>
          <Pill variant={estadoVariant}>{n.estado}</Pill>
        </div>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--ink-2)",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 5,
          }}
        >
          <Avatar name={orgName} size={26} />
          {orgName}
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 900 }}>{n.descripcion}</h3>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        {fechaLabel ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: priority === "urgent" ? "var(--urgent)" : "var(--ink-3)",
            }}
          >
            <Calendar size={15} /> {fechaLabel}
          </span>
        ) : (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-3)" }}>
            Sin vencimiento
          </span>
        )}
        <Button variant="primary" size="sm" style={{ gap: 6 }}>
          <Heart size={15} color="#fff" /> Donar
        </Button>
      </div>
    </Card>
  );
}

export default function NeedsPage() {
  const { data: necesidades, isPending, isError, refetch } = useNecesidades();
  const { data: orgs } = useValidatedOrganizaciones();

  const orgMap = new Map(orgs?.map((o) => [o.id, o.nombre]) ?? []);
  const count = necesidades?.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar active="Necesidades" />
      <div style={{ flex: 1, overflow: "auto", padding: "28px 40px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 22,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900 }}>Tablero de necesidades</h1>
            <p style={{ color: "var(--ink-2)", fontSize: 15, marginTop: 5, fontWeight: 600 }}>
              {isPending
                ? "Cargando..."
                : `${count} ${count === 1 ? "necesidad activa" : "necesidades activas"} de comedores de Córdoba`}
            </p>
          </div>
        </div>

        {/* urgency filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: ".04em",
            }}
          >
            Urgencia
          </span>
          {URGENCY.map((o, i) => (
            <span
              key={o}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                background: i === 0 ? "var(--earth)" : "var(--card)",
                color: i === 0 ? "#fff" : "var(--ink-2)",
                boxShadow: i === 0 ? "none" : "var(--sh-1)",
              }}
            >
              {o}
            </span>
          ))}
        </div>

        {isPending ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {Array.from({ length: 6 }, (_, i) => <OrgCardSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <ErrorState
            onRetry={() => refetch()}
            message="No pudimos cargar las necesidades. Intentá de nuevo."
          />
        ) : count === 0 ? (
          <EmptyState variant="no-donaciones" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {necesidades!.map((n) => (
              <NeedCard
                key={n.id}
                n={n}
                orgName={orgMap.get(n.organizacionId) ?? "Organización"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
