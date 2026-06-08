import { Add, More, TickSquare } from "iconsax-reactjs";
import { AdminShell } from "@/components/ui/admin-shell";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

const USERS = [
  { name: "María Belén Ríos",  email: "mb.rios@correo.ar",     role: "donor" as const, active: true,  last: "Hace 2 h" },
  { name: "Roberto Sosa",      email: "r.sosa@hornitos.ar",    role: "org"   as const, active: true,  last: "Hoy" },
  { name: "Diego Funes",       email: "d.funes@elhornero.ar",  role: "val"   as const, active: true,  last: "Hace 15 min" },
  { name: "Lucía Pérez",       email: "l.perez@elnido.ar",     role: "org"   as const, active: true,  last: "Ayer" },
  { name: "Carla Vega",        email: "c.vega@elhornero.ar",   role: "super" as const, active: true,  last: "Hace 1 h" },
  { name: "Andrés Luna",       email: "a.luna@correo.ar",      role: "donor" as const, active: false, last: "Hace 3 sem" },
  { name: "Paula Ruiz",        email: "p.ruiz@correo.ar",      role: "val"   as const, active: true,  last: "Hoy" },
  { name: "Tomás Bianchi",     email: "t.bianchi@correo.ar",   role: "donor" as const, active: false, last: "Hace 2 meses" },
];

const ROLE_PILL = {
  donor: { variant: "role-donor" as const, label: "Donante" },
  org:   { variant: "role-org"   as const, label: "Admin. Organización" },
  val:   { variant: "role-val"   as const, label: "Validador" },
  super: { variant: "role-super" as const, label: "Super Admin" },
};

const SELECTED = new Set([0, 2, 5]);

export default function UsersPage() {
  return (
    <AdminShell
      active="Usuarios"
      title="Gestión de usuarios"
      subtitle="Administrá roles, permisos y estados de las cuentas de la plataforma"
      role="Super Admin"
      name="Carla Vega"
      tint={4}
      actions={
        <Button variant="primary" style={{ gap: 8 }}>
          <Add size={18} color="#fff" /> Invitar usuario
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* bulk bar */}
        <Card style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, background: "var(--straw)", boxShadow: "none" }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--earth)" }}>{SELECTED.size} seleccionados</span>
          <div style={{ width: 1, height: 24, background: "rgba(122,42,8,.15)" }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-2)" }}>Asignar rol:</span>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.values(ROLE_PILL).map(({ variant, label }) => (
              <span key={label} style={{ cursor: "pointer" }}>
                <Pill variant={variant}>{label}</Pill>
              </span>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <Button variant="secondary" size="sm">Activar</Button>
          <button
            style={{
              padding: "9px 14px",
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: "pointer",
              background: "#fff",
              color: "var(--urgent)",
              boxShadow: "inset 0 0 0 1.6px var(--bad-bg)",
              border: "none",
            }}
          >
            Desactivar
          </button>
        </Card>

        {/* table */}
        <Card style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "36px 2.4fr 1.7fr 1fr 1fr 60px",
              gap: 12,
              padding: "15px 24px",
              borderBottom: "1px solid var(--line)",
              fontSize: 12.5,
              fontWeight: 800,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: ".04em",
              alignItems: "center",
            }}
          >
            <span style={{ width: 19, height: 19, borderRadius: 6, border: "2px solid var(--line)", display: "inline-block" }} />
            <span>Usuario</span>
            <span>Rol</span>
            <span>Estado</span>
            <span>Actividad</span>
            <span />
          </div>

          {USERS.map((u, i) => {
            const { variant, label } = ROLE_PILL[u.role];
            const sel = SELECTED.has(i);
            return (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 2.4fr 1.7fr 1fr 1fr 60px",
                  gap: 12,
                  padding: "13px 24px",
                  borderBottom: i < USERS.length - 1 ? "1px solid var(--line-soft)" : "none",
                  alignItems: "center",
                  background: sel ? "#FBF1E2" : "transparent",
                }}
              >
                <span
                  style={{
                    width: 19,
                    height: 19,
                    borderRadius: 6,
                    border: sel ? "none" : "2px solid var(--line)",
                    background: sel ? "var(--horn)" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {sel && <TickSquare size={13} color="#fff" variant="Bold" />}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <Avatar name={u.name} size={42} tintIndex={i} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{u.name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 700 }}>{u.email}</div>
                  </div>
                </div>

                <span><Pill variant={variant}>{label}</Pill></span>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontWeight: 800,
                    fontSize: 13.5,
                    color: u.active ? "var(--ok)" : "var(--ink-3)",
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: u.active ? "var(--ok)" : "var(--ink-3)" }} />
                  {u.active ? "Activo" : "Inactivo"}
                </span>

                <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink-2)" }}>{u.last}</span>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button variant="ghost" size="sm" style={{ padding: "8px 10px" }}>
                    <More size={18} color="var(--ink-3)" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </AdminShell>
  );
}
