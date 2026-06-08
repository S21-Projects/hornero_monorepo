import { Clock, Sms, Location, Heart, Routing, Shield, Truck } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Stars } from "@/components/ui/stars";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import { Box } from "iconsax-reactjs";

const NEEDS = [
  { title: "Leche en polvo",   sub: "Para la copa de leche de la tarde",     priority: "urgent" as const, progress: [18, 40] as const },
  { title: "Fideos y arroz",   sub: "Secos no perecederos · paquetes de 1kg", priority: "medium" as const, progress: [60, 100] as const },
  { title: "Frutas y verduras",sub: "Frescas, para el almuerzo semanal",      priority: "normal" as const, progress: [25, 30] as const },
  { title: "Útiles escolares", sub: "Cuadernos, lápices y mochilas",          priority: "normal" as const, progress: [12, 50] as const },
];

const DONATIONS = [
  { who: "María Belén Ríos",    what: "20 kg de leche en polvo",    date: "Hoy · 11:20",  status: "transit" as const },
  { who: "Panadería La Esquina",what: "Pan y facturas",             date: "Ayer",          status: "delivered" as const },
  { who: "Club Atlético Belgrano", what: "Caja de fideos y arroz",  date: "Hace 2 días",  status: "received" as const },
  { who: "Familia Gómez",       what: "Frutas y verduras de estación", date: "Hace 3 días", status: "delivered" as const },
];

const PRIORITY_MAP = { urgent: "urgent", medium: "medium", normal: "normal" } as const;
const PRIORITY_LABEL = { urgent: "Urgente", medium: "Media", normal: "Normal" };
const STATUS_MAP = {
  received:  { variant: "ok",   label: "Recibido",   icon: <Shield size={13} /> },
  transit:   { variant: "warn", label: "En camino",  icon: <Truck size={13} /> },
  delivered: { variant: "open", label: "Entregado",  icon: <Shield size={13} /> },
} as const;

export default function OrgDetailPage() {
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
            <div style={{ flex: 1, color: "#fff", paddingBottom: 4 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Pill variant="open" dot>Abierto · cierra 15:00</Pill>
                <Pill variant="solid" style={{ background: "rgba(255,255,255,.22)" }}>Validado</Pill>
              </div>
              <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 900 }}>Comedor Los Hornitos</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, fontWeight: 700, fontSize: 14.5, opacity: 0.95 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Location size={16} color="#fff" />
                  Av. Colón 1240, B° Alberdi
                </span>
                <Stars value={4.8} showNum />
              </div>
            </div>
          </div>
        </div>

        {/* body */}
        <div style={{ display: "flex", gap: 28, padding: "28px 40px", alignItems: "flex-start" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
            {/* about */}
            <Card style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Sobre el comedor</h3>
              <p style={{ color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6, fontWeight: 600 }}>
                Atendemos a más de 180 familias del barrio Alberdi con almuerzo diario y copa de leche por la tarde.
                Funcionamos hace 12 años gracias a vecinos y donantes de toda Córdoba.
              </p>
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
                      <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 700 }}>{title}</div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* needs */}
            <Card style={{ padding: "20px 24px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900 }}>Necesidades activas</h3>
                <Pill variant="ghost">4 abiertas</Pill>
              </div>
              {NEEDS.map(({ title, sub, priority, progress }) => (
                <div key={title} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Box size={22} color="var(--horn)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h4 style={{ fontSize: 15.5, fontWeight: 800 }}>{title}</h4>
                      <Pill variant={PRIORITY_MAP[priority]}>{PRIORITY_LABEL[priority]}</Pill>
                    </div>
                    <p style={{ color: "var(--ink-2)", fontSize: 13.5, marginTop: 4, fontWeight: 600 }}>{sub}</p>
                  </div>
                  <div style={{ width: 150, flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink-2)", marginBottom: 6, textAlign: "right" }}>
                      {progress[0]}/{progress[1]}
                    </div>
                    <Progress value={progress[0]} max={progress[1]} />
                  </div>
                </div>
              ))}
            </Card>

            {/* donations */}
            <Card style={{ padding: "20px 24px 8px" }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Donaciones recientes</h3>
              {DONATIONS.map(({ who, what, date, status }) => {
                const s = STATUS_MAP[status];
                return (
                  <div key={who} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--line-soft)" }}>
                    <Avatar name={who} size={40} tintIndex={who.length % 6} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5 }}>{who}</div>
                      <div style={{ color: "var(--ink-2)", fontSize: 13, fontWeight: 600 }}>{what}</div>
                    </div>
                    <div style={{ color: "var(--ink-3)", fontSize: 12.5, fontWeight: 700, marginRight: 8 }}>{date}</div>
                    <Pill variant={s.variant} dot>
                      {s.icon} {s.label}
                    </Pill>
                  </div>
                );
              })}
            </Card>
          </div>

          {/* right rail */}
          <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            <Card style={{ padding: 22, background: "var(--straw)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Pill variant="urgent">Urgente</Pill>
                <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 700 }}>vence en 3 días</span>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 900 }}>Leche en polvo</h3>
              <p style={{ color: "var(--ink-2)", fontSize: 14, marginTop: 6, fontWeight: 600, lineHeight: 1.5 }}>
                18 de 40 kg reunidos. Cada aporte suma para la merienda de los chicos.
              </p>
              <div style={{ margin: "14px 0 18px" }}>
                <Progress value={18} max={40} height={11} />
              </div>
              <Button variant="primary" block style={{ fontSize: 16, gap: 8 }}>
                <Heart size={18} color="#fff" /> Donar a esta necesidad
              </Button>
              <Button variant="ghost" block style={{ marginTop: 8, gap: 8 }}>
                <Routing size={17} color="var(--ink-2)" /> Cómo llegar
              </Button>
            </Card>

            <Card style={{ padding: 20 }}>
              <h4 style={{ fontSize: 15, fontWeight: 900, marginBottom: 12 }}>Ubicación</h4>
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
