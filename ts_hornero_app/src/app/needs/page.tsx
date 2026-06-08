import { Heart, More, Calendar, TickCircle } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";

const NEEDS = [
  { org: "Comedor Los Hornitos",     title: "Leche en polvo",   cat: "Almuerzo",   priority: "urgent" as const, exp: "Vence en 3 días",  have: 18, need: 40,  unit: "kg",   done: false },
  { org: "Merendero El Nido",        title: "Cacao y azúcar",   cat: "Merienda",   priority: "medium" as const, exp: "Vence en 9 días",  have: 24, need: 30,  unit: "kg",   done: false },
  { org: "Copa de Leche San Vicente",title: "Pan y galletitas", cat: "Merienda",   priority: "normal" as const, exp: "Vence en 14 días", have: 8,  need: 50,  unit: "paq",  done: false },
  { org: "Comedor Manos Abiertas",   title: "Fideos y arroz",   cat: "Almuerzo",   priority: "urgent" as const, exp: "Vence en 2 días",  have: 60, need: 100, unit: "kg",   done: false },
  { org: "Olla La Esperanza",        title: "Verduras frescas", cat: "Almuerzo",   priority: "medium" as const, exp: "Vence en 6 días",  have: 25, need: 30,  unit: "cajón",done: false },
  { org: "Merendero Sol Naciente",   title: "Yerba mate",       cat: "Desayuno",   priority: "normal" as const, exp: "Completada",       have: 40, need: 40,  unit: "kg",   done: true },
];

const PRIORITY_LABEL = { urgent: "Urgente", medium: "Media", normal: "Normal" };
const CATS = ["Todas", "Almuerzo", "Merienda", "Desayuno", "Donaciones"];
const URGENCY = ["Todas", "Urgente", "Media", "Normal"];

export default function NeedsPage() {
  if (NEEDS.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <TopBar active="Necesidades" />
        <EmptyState variant="no-donaciones" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar active="Necesidades" />
      <div style={{ flex: 1, overflow: "auto", padding: "28px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900 }}>Tablero de necesidades</h1>
            <p style={{ color: "var(--ink-2)", fontSize: 15, marginTop: 5, fontWeight: 600 }}>
              34 pedidos activos de comedores de Córdoba esperan tu ayuda
            </p>
          </div>
          <Button variant="secondary" style={{ gap: 8 }}>
            <TickCircle size={18} color="var(--earth)" /> Marcar como cumplida
          </Button>
        </div>

        {/* filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22, flexWrap: "wrap" }}>
          {[{ label: "Categoría", opts: CATS }, { label: "Urgencia", opts: URGENCY }].map((g) => (
            <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                {g.label}
              </span>
              {g.opts.map((o, i) => (
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
          ))}
        </div>

        {/* grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {NEEDS.map((n) => (
            <Card
              key={n.title}
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                opacity: n.done ? 0.7 : 1,
                border: n.done ? "1.5px solid var(--ok)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {n.done ? (
                    <Pill variant="ok" dot>
                      <TickCircle size={13} /> Cumplida
                    </Pill>
                  ) : (
                    <Pill variant={n.priority}>{PRIORITY_LABEL[n.priority]}</Pill>
                  )}
                  <Pill variant="cat">{n.cat}</Pill>
                </div>
                <More size={18} color="var(--ink-3)" />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-2)", fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#F6ECDC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 14c0-4 3-7 7-7 2 0 4 1 4 1l3-2-1 3s1 2 1 4c0 4-3 7-7 7" />
                    </svg>
                  </div>
                  {n.org}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900 }}>{n.title}</h3>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, marginBottom: 7 }}>
                  <span style={{ color: "var(--horn)" }}>{n.have} {n.unit}</span>
                  <span style={{ color: "var(--ink-3)" }}>de {n.need} {n.unit}</span>
                </div>
                <Progress value={n.have} max={n.need} height={10} />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: n.priority === "urgent" && !n.done ? "var(--urgent)" : "var(--ink-3)",
                  }}
                >
                  <Calendar size={15} /> {n.exp}
                </span>
                {n.done ? (
                  <Button variant="secondary" size="sm">Ver aportes</Button>
                ) : (
                  <Button variant="primary" size="sm" style={{ gap: 6 }}>
                    <Heart size={15} color="#fff" /> Donar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
