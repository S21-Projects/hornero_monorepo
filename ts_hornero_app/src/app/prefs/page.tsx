import { Sms, Notification, Heart, Box, TickCircle } from "iconsax-reactjs";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { ZonasMap } from "@/components/prefs/zonas-map";
import { Toast } from "@/components/ui/toast";
import { Text } from "@/components/ui/typography";

const FOOD_PREFS = [
  { icon: <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 13c2.5 0 4-2 4-4.5S14.5 4 12 4 8 6 8 8.5 9.5 13 12 13zM12 13v7" /></svg>, title: "Almuerzo",   sub: "Comedores que sirven el mediodía",         on: true },
  { icon: <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10a4 4 0 0 1 4-4h6a4 4 0 0 1 0 8H9a4 4 0 0 1-4-4z" /><path d="M9 6v8M13 6v8" /></svg>, title: "Desayuno",   sub: "Copa de leche y desayunos",                on: true },
  { icon: <Heart size={21} color="var(--horn)" />, title: "Merienda",   sub: "Meriendas y copa de leche de la tarde",   on: false },
  { icon: <Box size={21} color="var(--horn)" />,   title: "Mercadería", sub: "Donaciones de alimentos no perecederos", on: true },
];

const CHANNEL_PREFS = [
  { icon: <Sms size={21} color="var(--horn)" />,          title: "Email",                  sub: "mb.rios@correo.ar",               on: true },
  { icon: <Notification size={21} color="var(--horn)" />, title: "Notificaciones push",    sub: "En tu teléfono y navegador",     on: true },
];

const ZONES = ["Alberdi", "San Vicente", "General Paz", "Nueva Córdoba", "Yofre", "Centro"];
const ACTIVE_ZONES = new Set([0, 1, 3]);

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 46,
        height: 27,
        borderRadius: 999,
        background: on ? "var(--sky)" : "var(--line)",
        display: "inline-flex",
        alignItems: "center",
        padding: 3,
        flexShrink: 0,
        justifyContent: on ? "flex-end" : "flex-start",
        transition: "background .15s",
      }}
    >
      <span
        style={{
          width: 21,
          height: 21,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
        }}
      />
    </span>
  );
}

function PrefRow({ icon, title, sub, on }: { icon: React.ReactNode; title: string; sub: string; on: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: "var(--card-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <Text as="div" variant="title">{title}</Text>
        <Text as="div" variant="label" color="ink-2" style={{ marginTop: 2 }}>{sub}</Text>
      </div>
      <Toggle on={on} />
    </div>
  );
}

export default function PrefsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar active="Preferencias" />
      <div className="flex-1 overflow-auto px-4 py-7 sm:px-10">
        <div style={{ marginBottom: 24 }}>
          <Text variant="h1">Preferencias de notificación</Text>
          <Text variant="body" color="ink-2" style={{ marginTop: 5 }}>
            Elegí qué necesidades y zonas te avisamos. Recibí alertas solo de lo que te importa.
          </Text>
        </div>

        <div className="flex flex-col sm:flex-row gap-7 sm:items-start">
          {/* left */}
          <div className="flex flex-col flex-1 min-w-0" style={{ gap: 22 }}>
            <Card style={{ padding: "20px 24px 8px" }}>
              <Text variant="h3" as="h3" style={{ fontSize: 17, marginBottom: 4 }}>Categorías de alimento</Text>
              {FOOD_PREFS.map((p) => (
                <PrefRow key={p.title} {...p} />
              ))}
            </Card>

            <Card style={{ padding: "20px 24px" }}>
              <Text variant="h3" as="h3" style={{ fontSize: 17, marginBottom: 6 }}>Canales</Text>
              {CHANNEL_PREFS.map((p) => (
                <PrefRow key={p.title} {...p} />
              ))}
            </Card>
          </div>

          {/* right */}
          <div className="flex flex-col w-full sm:w-[380px] sm:flex-shrink-0" style={{ gap: 22 }}>
            <Card style={{ padding: 20 }}>
              <Text variant="h3" as="h3" style={{ fontSize: 17, marginBottom: 4 }}>Zonas de interés</Text>
              <Text as="p" variant="label" color="ink-2" style={{ marginBottom: 14 }}>
                Tocá los barrios donde querés ayudar.
              </Text>
              <div style={{ borderRadius: 14, overflow: "hidden", height: 190, position: "relative", marginBottom: 14 }}>
                <ZonasMap height={190} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ZONES.map((z, i) => {
                  const active = ACTIVE_ZONES.has(i);
                  return (
                    <span
                      key={z}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 13px",
                        borderRadius: 999,
                        cursor: "pointer",
                        background: active ? "var(--sky-bg)" : "var(--card-2)",
                      }}
                    >
                      {active && <TickCircle size={13} color="#1C6E96" variant="Bold" />}
                      <Text variant="label" as="span" style={{ color: active ? '#1C6E96' : 'var(--ink-2)' }}>{z}</Text>
                    </span>
                  );
                })}
              </div>
            </Card>

            {/* notification preview */}
            <div>
              <Text
                as="div"
                variant="caption"
                color="ink-3"
                style={{ textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}
              >
                Vista previa de la alerta
              </Text>
              <Toast
                icon={<Notification size={20} color="var(--horn)" />}
                title="Nueva necesidad cerca tuyo"
                body={
                  <>
                    <b style={{ color: "var(--ink)" }}>Comedor Los Hornitos</b> (Alberdi) necesita{" "}
                    <b style={{ color: "var(--ink)" }}>leche en polvo</b> para la merienda.
                  </>
                }
                action={
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Pill variant="urgent" style={{ fontSize: 10.5, padding: "4px 8px" }}>Urgente</Pill>
                    <a href="/needs" style={{ textDecoration: "none" }}>
                      <Text as="span" variant="label" style={{ color: "var(--sky)" }}>Ver necesidad →</Text>
                    </a>
                  </div>
                }
              />
            </div>

            <Button variant="primary" block>
              Guardar preferencias
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
