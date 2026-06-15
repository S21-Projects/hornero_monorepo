import { notFound } from "next/navigation";
import { Clock, Sms, Location, Heart, Routing, Shield, Truck } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Stars } from "@/components/ui/stars";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import { Text } from "@/components/ui/typography";
import { Box } from "iconsax-reactjs";
import { getOrganizacionBySlug } from "@/lib/api/organizaciones.server";
import {
  getDonacionesByOrg,
  getNecesidadesByOrg,
  mapEstadoDonacion,
  mapPrioridad,
  PRIORITY_ORDER,
} from "@/lib/api/donaciones.server";
import { TIPO_ORGANIZACION_LABELS, type TipoOrganizacion } from "@/lib/tipos-organizacion";

export const revalidate = 60;

const PRIORITY_LABEL = { urgent: "Urgente", medium: "Media", normal: "Normal" } as const;
const STATUS_MAP = {
  received:  { variant: "ok",   label: "Recibido",   icon: <Shield size={13} /> },
  transit:   { variant: "warn", label: "En camino",  icon: <Truck size={13} /> },
  delivered: { variant: "open", label: "Entregado",  icon: <Shield size={13} /> },
} as const;

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let org;
  try {
    org = await getOrganizacionBySlug(slug);
  } catch {
    notFound();
  }

  const [rawNecesidades, rawDonaciones] = await Promise.all([
    getNecesidadesByOrg(org.id),
    getDonacionesByOrg(org.id),
  ]);

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
    status: mapEstadoDonacion(d.estado),
  }));

  // Right-rail CTA: pick the highest-priority need (URGENTE > MEDIA > NORMAL)
  const ctaNeed = needs.length > 0
    ? needs.slice().sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])[0]
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar active="Mapa" />
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* hero */}
        <div style={{ position: "relative", height: 240, background: "var(--card-2)" }}>
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
              }}
            >
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 14c0-4 3-7 7-7 2 0 4 1 4 1l3-2-1 3s1 2 1 4c0 4-3 7-7 7" />
                <circle cx="10" cy="11" r="1" fill="var(--horn)" stroke="none" />
                <path d="M5 14c-1 2-2 3-3 3 1 1 3 1 4 0" />
              </svg>
            </div>
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Pill variant="open" dot>Abierto · cierra 15:00</Pill>
                <Pill variant="cat">{TIPO_ORGANIZACION_LABELS[org.tipo as TipoOrganizacion] ?? org.tipo}</Pill>
                <Pill variant="solid" style={{ background: "rgba(255,255,255,.22)" }}>
                  {org.validada ? "Validado" : "Pendiente"}
                </Pill>
              </div>
              <Text variant="h1" as="h1" style={{ color: "#fff", fontSize: 32 }}>{org.nombre}</Text>
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
                <Stars value={4.8} showNum />
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
              <div style={{ display: "flex", gap: 28, marginTop: 18, flexWrap: "wrap" }}>
                {[
                  { icon: <Clock size={20} color="var(--horn)" />, title: "Almuerzo",  sub: "Lun a Vie · 12:00–15:00" },
                  { icon: <Clock size={20} color="var(--horn)" />, title: "Merienda",  sub: "Lun a Sáb · 16:30–18:00" },
                  { icon: <Sms size={20} color="var(--horn)" />,   title: "Contacto",  sub: "hornitos@correo.ar" },
                ].map(({ icon, title, sub }) => (
                  <div key={title} style={{ display: "flex", gap: 11, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {icon}
                    </div>
                    <div>
                      <Text as="div" variant="caption" color="ink-3">{title}</Text>
                      <Text as="div" variant="body-sm">{sub}</Text>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* needs — only render when there are results */}
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
                  </div>
                ))}
              </Card>
            )}

            {/* donations — only render when there are results */}
            {donations.length > 0 && (
              <Card style={{ padding: "20px 24px 8px" }}>
                <Text variant="h3" as="h3" style={{ marginBottom: 4 }}>Donaciones recientes</Text>
                {donations.map(({ id, who, what, date, status }) => {
                  const s = STATUS_MAP[status];
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--line-soft)" }}>
                      <Avatar name={who} size={40} tintIndex={who.length % 6} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text as="div" variant="body-sm">{who}</Text>
                        <Text as="div" variant="label" color="ink-2">{what}</Text>
                      </div>
                      <Text as="div" variant="caption" color="ink-3" style={{ marginRight: 8 }}>{date}</Text>
                      <Pill variant={s.variant} dot>
                        {s.icon} {s.label}
                      </Pill>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>

          {/* right rail */}
          <div className="flex flex-col w-full sm:w-[320px] sm:flex-shrink-0" style={{ gap: 18 }}>
            {/* CTA — only render when there are needs */}
            {ctaNeed && (
              <Card style={{ padding: 22, background: "var(--straw)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Pill variant={ctaNeed.priority}>{PRIORITY_LABEL[ctaNeed.priority]}</Pill>
                </div>
                <Text variant="h3" as="h3">{ctaNeed.title}</Text>
                <Text variant="body-sm" color="ink-2" style={{ marginTop: 6 }}>
                  {ctaNeed.sub}
                </Text>
                <div style={{ margin: "14px 0 18px" }}>
                  <Progress value={0} max={1} height={11} />
                </div>
                <Button variant="primary" block style={{ gap: 8 }}>
                  <Heart size={18} color="#fff" /> Donar a esta necesidad
                </Button>
                <Button variant="ghost" block style={{ marginTop: 8, gap: 8 }}>
                  <Routing size={17} color="var(--ink-2)" /> Cómo llegar
                </Button>
              </Card>
            )}

            <Card style={{ padding: 20 }}>
              <Text variant="title" as="h4" style={{ marginBottom: 12 }}>Ubicación</Text>
              <div style={{ borderRadius: 14, overflow: "hidden", height: 150 }}>
                <MapPlaceholder pins={[{ x: "50%", y: "50%", active: false }]} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
