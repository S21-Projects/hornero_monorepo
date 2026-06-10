import Link from "next/link";
import { Location } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getValidatedOrganizaciones } from "@/lib/api/organizaciones.server";
import type { OrganizacionResponse } from "@/lib/api/organizaciones";

export const revalidate = 60;

const TIPOS = ["Todos", "Comedor", "Merendero", "Ropero"];

function OrgRow({ org }: { org: OrganizacionResponse }) {
  return (
    <Link href={`/org/${org.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      <Card
        style={{
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          cursor: "pointer",
          transition: "box-shadow .15s",
        }}
      >
        <Avatar name={org.nombre} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800 }}>{org.nombre}</h3>
            <Pill variant="cat">{org.tipo}</Pill>
            {org.validada && <Pill variant="ok">Validada</Pill>}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--ink-2)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <Location size={14} color="var(--ink-3)" />
            {org.direccion ?? "Córdoba"}
          </div>
          {org.descripcion && (
            <p
              style={{
                color: "var(--ink-3)",
                fontSize: 13,
                fontWeight: 600,
                marginTop: 5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {org.descripcion}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default async function OrganizacionesPage() {
  let orgs: OrganizacionResponse[] = [];
  try {
    orgs = await getValidatedOrganizaciones();
  } catch {
    // show empty state below
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar active="Mapa" />
      <div style={{ flex: 1, overflow: "auto", padding: "28px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900 }}>Organizaciones</h1>
            <p style={{ color: "var(--ink-2)", fontSize: 15, marginTop: 5, fontWeight: 600 }}>
              {orgs.length} {orgs.length === 1 ? "organización validada" : "organizaciones validadas"} en Córdoba
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          {TIPOS.map((t, i) => (
            <span
              key={t}
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
              {t}
            </span>
          ))}
        </div>

        {orgs.length === 0 ? (
          <EmptyState variant="no-comedores" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {orgs.map((org) => (
              <OrgRow key={org.id} org={org} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
