'use client';

import { notFound } from "next/navigation";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sms, Location, Heart, Routing } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { MapDynamic } from "@/components/ui/map-dynamic";
import { DonateButton } from "@/components/donaciones/donate-button";
import { Text } from "@/components/ui/typography";
import { Box } from "iconsax-reactjs";
import { fetchOrganizacionBySlug } from "@/lib/api/organizaciones";
import {
  fetchDonacionesByOrg,
  fetchNecesidadesByOrg,
  mapPrioridad,
  PRIORITY_ORDER,
  ESTADO_DONACION_LABELS,
  ESTADO_DONACION_PILL,
} from "@/lib/api/donaciones.server";
import { TIPO_ORGANIZACION_LABELS, type TipoOrganizacion } from "@/lib/tipos-organizacion";
import { OrgEditButton } from "@/components/org/OrgEditButton";

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? '';

const PRIORITY_LABEL = { urgent: "Urgente", medium: "Media", normal: "Normal" } as const;

export default function OrgDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const { data: org, isLoading: orgLoading, isError } = useQuery({
    queryKey: ['org', slug],
    queryFn: () => fetchOrganizacionBySlug(slug),
    retry: false,
  });

  const { data: rawNecesidades = [] } = useQuery({
    queryKey: ['org-necesidades', org?.id],
    queryFn: () => fetchNecesidadesByOrg(org!.id),
    enabled: !!org?.id,
  });

  const { data: rawDonaciones = [] } = useQuery({
    queryKey: ['org-donaciones', org?.id],
    queryFn: () => fetchDonacionesByOrg(org!.id),
    enabled: !!org?.id,
  });

  if (orgLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <TopBar active="Mapa" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text variant="body" color="ink-3">Cargando...</Text>
        </div>
      </div>
    );
  }

  if (isError || !org) {
    notFound();
  }

  const needs = rawNecesidades.map((n) => ({
    id: n.id,
    title: n.descripcion,
    sub: n.estado,
    priority: mapPrioridad(n.prioridad),
  }));

  const donations = rawDonaciones.map((d) => ({
    id: d.id,
    who: d.donanteName,
    what: d.observaciones ?? "",
    date: d.fechaOferta,
    estado: d.estado,
  }));

  const ctaNeed = needs.length > 0
    ? needs.slice().sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])[0]
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar active="Mapa" />
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* hero */}
        <div style={{ position: "relative", height: 240, background: "var(--card-2)" }}>
          {org.bannerKey && (
            <img
              src={`${BFF}/images?key=${org.bannerKey}`}
              alt=""
              aria-hidden
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(200,90,32,.30) 0%, rgba(122,42,8,.82) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 40,
              bottom: 26,
              right: 40,
              display: "flex",
              alignItems: "flex-end",
              gap: 20,
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 14,
                background: "#F6ECDC",
                border: "3px solid #fff",
                boxShadow: "var(--sh-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {org.profileImageKey ? (
                <img
                  src={`${BFF}/images?key=${org.profileImageKey}`}
                  alt={`${org.nombre} profile`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 14c0-4 3-7 7-7 2 0 4 1 4 1l3-2-1 3s1 2 1 4c0 4-3 7-7 7" />
                  <circle cx="10" cy="11" r="1" fill="var(--horn)" stroke="none" />
                  <path d="M5 14c-1 2-2 3-3 3 1 1 3 1 4 0" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Pill variant="cat">{TIPO_ORGANIZACION_LABELS[org.tipo as TipoOrganizacion] ?? org.tipo}</Pill>
                <Pill variant="solid" style={{ background: "rgba(255,255,255,.22)" }}>
                  {org.validada ? "Validado" : "Pendiente"}
                </Pill>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Text variant="h1" as="h1" style={{ color: "#fff", fontSize: 32 }}>{org.nombre}</Text>
                <OrgEditButton org={org} />
              </div>
              <Text
                as="div"
                variant="body-sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginTop: 8,
                  opacity: 0.95,
                  color: "#fff",
                  fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"],
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Location size={16} color="#fff" />
                  {org.direccion ?? "Sin dirección"}
                </span>
              </Text>
            </div>
          </div>
        </div>

        {/* body */}
        <div className="flex flex-col sm:flex-row gap-7 sm:items-start px-4 py-7 sm:px-10">
          <div className="flex flex-col flex-1 min-w-0" style={{ gap: 22 }}>
            {/* about */}
            <Card style={{ padding: 24 }}>
              <Text variant="h3" as="h3" style={{ marginBottom: 6 }}>Sobre el comedor</Text>
              <Text variant="body" color="ink-2">
                {org.descripcion ?? ""}
              </Text>
              {org.referenteEmail && (
                <div style={{ display: "flex", gap: 28, marginTop: 18, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Sms size={20} color="var(--horn)" />
                    </div>
                    <div>
                      <Text as="div" variant="caption" color="ink-3">Contacto</Text>
                      <Text as="div" variant="body-sm">{org.referenteEmail}</Text>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {needs.length > 0 && (
              <Card style={{ padding: "20px 24px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text variant="h3" as="h3">Necesidades activas</Text>
                  <Pill variant="ghost">{needs.length} abiertas</Pill>
                </div>
                {needs.map(({ id, title, sub, priority }) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--line-soft)" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Box size={22} color="var(--horn)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Text variant="body" as="h4">{title}</Text>
                        <Pill variant={priority}>{PRIORITY_LABEL[priority]}</Pill>
                      </div>
                      <Text variant="label" as="p" color="ink-2" style={{ marginTop: 4 }}>{sub}</Text>
                    </div>
                    <DonateButton
                      necesidadId={id}
                      necesidadDescripcion={title}
                      orgNombre={org.nombre}
                      variant="secondary"
                      size="sm"
                    />
                  </div>
                ))}
              </Card>
            )}

            {donations.length > 0 && (
              <Card style={{ padding: "20px 24px 8px" }}>
                <Text variant="h3" as="h3" style={{ marginBottom: 4 }}>Donaciones recientes</Text>
                {donations.map(({ id, who, what, date, estado }) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--line-soft)" }}>
                    <Avatar name={who} size={40} tintIndex={who.length % 6} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text as="div" variant="body-sm">{who}</Text>
                      <Text as="div" variant="label" color="ink-2">{what}</Text>
                    </div>
                    <Text as="div" variant="caption" color="ink-3" style={{ marginRight: 8 }}>{date}</Text>
                    <Pill variant={ESTADO_DONACION_PILL[estado] ?? "ghost"} dot>
                      {ESTADO_DONACION_LABELS[estado] ?? estado}
                    </Pill>
                  </div>
                ))}
              </Card>
            )}
          </div>

          {/* right rail */}
          <div className="flex flex-col w-full sm:w-[320px] sm:flex-shrink-0" style={{ gap: 18 }}>
            {ctaNeed && (
              <Card style={{ padding: 22, background: "var(--straw)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Pill variant={ctaNeed.priority}>{PRIORITY_LABEL[ctaNeed.priority]}</Pill>
                </div>
                <Text variant="h3" as="h3">{ctaNeed.title}</Text>
                <Text variant="body-sm" color="ink-2" style={{ marginTop: 6 }}>
                  {ctaNeed.sub}
                </Text>
                <DonateButton
                  necesidadId={ctaNeed.id}
                  necesidadDescripcion={ctaNeed.title}
                  orgNombre={org.nombre}
                  variant="primary"
                  size="default"
                  block
                  style={{ marginTop: 14 }}
                >
                  <Heart size={18} color="#fff" /> Donar a esta necesidad
                </DonateButton>
                <Button variant="ghost" block style={{ marginTop: 8, gap: 8 }}>
                  <Routing size={17} color="var(--ink-2)" /> Cómo llegar
                </Button>
              </Card>
            )}

            <Card style={{ padding: 20 }}>
              <Text variant="title" as="h4" style={{ marginBottom: 12 }}>Ubicación</Text>
              {org.latitud != null && org.longitud != null ? (
                <div style={{ borderRadius: 14, overflow: "hidden", height: 150 }}>
                  <MapDynamic
                    markers={[{ id: org.id, lat: org.latitud, lng: org.longitud, active: true, label: org.nombre }]}
                    center={{ lat: org.latitud, lng: org.longitud }}
                    zoom={15}
                    height={150}
                    interactive={false}
                  />
                </div>
              ) : (
                <Text variant="body" color="ink-2">
                  {org.direccion ?? "Ubicación no disponible"}
                </Text>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
