'use client';

import { Shield, Truck } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { OrgCardSkeleton } from "@/components/ui/skeleton";
import { useDonaciones } from "@/lib/hooks/useDonaciones";
import { useValidatedOrganizaciones } from "@/lib/hooks/useValidatedOrganizaciones";
import { mapEstadoDonacion, type DonacionResponse } from "@/lib/api/donaciones.server";

const STATUS_MAP = {
  transit: {
    variant: "warn" as const,
    label: "En camino",
    icon: <Truck size={13} />,
  },
  delivered: {
    variant: "ok" as const,
    label: "Entregado",
    icon: <Shield size={13} />,
  },
  received: {
    variant: "ghost" as const,
    label: "Ofrecida",
    icon: <Shield size={13} />,
  },
};

function DonacionCard({
  d,
  orgName,
}: {
  d: DonacionResponse;
  orgName: string;
}) {
  const uiStatus = mapEstadoDonacion(d.estado);
  const statusMeta = STATUS_MAP[uiStatus];
  const fechaLabel = d.fechaOferta
    ? new Date(d.fechaOferta).toLocaleDateString("es-AR")
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
      {/* header row: avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={d.donanteName} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{d.donanteName}</div>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--ink-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {orgName}
          </div>
        </div>
      </div>

      {/* observaciones */}
      {d.observaciones && (
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink-2)",
            margin: 0,
          }}
        >
          {d.observaciones}
        </p>
      )}

      {/* footer row: estado pill + date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 2,
        }}
      >
        <Pill variant={statusMeta.variant}>
          {statusMeta.icon} {statusMeta.label}
        </Pill>
        {fechaLabel && (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--ink-3)",
            }}
          >
            {fechaLabel}
          </span>
        )}
      </div>
    </Card>
  );
}

export default function DonacionesPage() {
  const { data: donaciones, isPending, isError, refetch } = useDonaciones();
  const { data: orgs } = useValidatedOrganizaciones();

  const orgMap = new Map(orgs?.map((o) => [o.id, o.nombre]) ?? []);
  const count = donaciones?.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar active="Donaciones" />
      <div style={{ flex: 1, overflow: "auto", padding: "28px 40px" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900 }}>Historial de donaciones</h1>
          <p style={{ color: "var(--ink-2)", fontSize: 15, marginTop: 5, fontWeight: 600 }}>
            {isPending
              ? "Cargando..."
              : `${count} ${count === 1 ? "donación registrada" : "donaciones registradas"}`}
          </p>
        </div>

        {isPending ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {Array.from({ length: 6 }, (_, i) => <OrgCardSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <ErrorState
            onRetry={() => refetch()}
            message="No pudimos cargar las donaciones. Intentá de nuevo."
          />
        ) : count === 0 ? (
          <EmptyState variant="no-donaciones" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {donaciones!.map((d) => (
              <DonacionCard
                key={d.id}
                d={d}
                orgName={orgMap.get(d.organizacionId) ?? "Organización"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
