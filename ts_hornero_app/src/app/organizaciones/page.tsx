'use client';

import { useState } from "react";
import Link from "next/link";
import { Location } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { OrgCardSkeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { InfiniteList } from "@/components/ui/InfiniteList";
import { useOrganizacionesInfinite } from "@/lib/hooks/useOrganizacionesInfinite";
import type { OrganizacionResponse } from "@/lib/api/organizaciones";
import { TIPO_ORGANIZACION_LABELS, TIPO_ORGANIZACION_OPTIONS, type TipoOrganizacion } from "@/lib/tipos-organizacion";

const FILTER_OPTIONS = [
  { label: 'Todos', value: '' },
  ...TIPO_ORGANIZACION_OPTIONS,
];

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
            <Text variant="title" as="h3">{org.nombre}</Text>
            <Pill variant="cat">{TIPO_ORGANIZACION_LABELS[org.tipo as TipoOrganizacion] ?? org.tipo}</Pill>
            {org.validada && <Pill variant="ok">Validada</Pill>}
          </div>
          <Text
            as="div"
            variant="body-sm"
            color="ink-2"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Location size={14} color="var(--ink-3)" />
            {org.direccion ?? "Córdoba"}
          </Text>
          {org.descripcion && (
            <Text
              variant="body-sm"
              color="ink-3"
              style={{ marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {org.descripcion}
            </Text>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default function OrganizacionesPage() {
  const { data, isPending, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrganizacionesInfinite(20);
  const [activeFilter, setActiveFilter] = useState<string>('');

  const allOrgs = data?.pages.flatMap((p) => p.content) ?? [];
  const filteredOrgs = allOrgs.filter(
    (o) => activeFilter === '' || o.tipo === activeFilter
  );
  const count = filteredOrgs.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar active="Organizaciones" />
      <div className="flex-1 overflow-auto px-4 py-7 sm:px-10">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <Text variant="h1">Organizaciones</Text>
            <Text variant="body" color="ink-2" style={{ marginTop: 5 }}>
              {isPending
                ? "Cargando..."
                : `${count} ${count === 1 ? "organización validada" : "organizaciones validadas"} en Córdoba`}
            </Text>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          {FILTER_OPTIONS.map(({ label, value }) => {
            const isActive = value === activeFilter;
            return (
              <span
                key={value}
                onClick={() => setActiveFilter(value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  cursor: "pointer",
                  background: isActive ? "var(--earth)" : "var(--card)",
                  boxShadow: isActive ? "none" : "var(--sh-1)",
                }}
              >
                <Text variant="label" as="span" style={{ color: isActive ? '#fff' : 'var(--ink-2)' }}>{label}</Text>
              </span>
            );
          })}
        </div>

        {isPending ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }, (_, i) => <OrgCardSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} message="No pudimos cargar las organizaciones. Intentá de nuevo." />
        ) : count === 0 ? (
          <EmptyState variant="no-comedores" />
        ) : (
          <InfiniteList
            hasNextPage={!!hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredOrgs.map((org) => (
                <OrgRow key={org.id} org={org} />
              ))}
            </div>
          </InfiniteList>
        )}
      </div>
    </div>
  );
}
