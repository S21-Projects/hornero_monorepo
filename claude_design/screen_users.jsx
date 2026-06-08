/* screen_users.jsx — User management */

const USERS = [
  { name: 'María Belén Ríos', email: 'mb.rios@correo.ar', role: 'donor', active: true, last: 'Hace 2 h' },
  { name: 'Roberto Sosa', email: 'r.sosa@hornitos.ar', role: 'org', active: true, last: 'Hoy' },
  { name: 'Diego Funes', email: 'd.funes@elhornero.ar', role: 'val', active: true, last: 'Hace 15 min' },
  { name: 'Lucía Pérez', email: 'l.perez@elnido.ar', role: 'org', active: true, last: 'Ayer' },
  { name: 'Carla Vega', email: 'c.vega@elhornero.ar', role: 'super', active: true, last: 'Hace 1 h' },
  { name: 'Andrés Luna', email: 'a.luna@correo.ar', role: 'donor', active: false, last: 'Hace 3 sem' },
  { name: 'Paula Ruiz', email: 'p.ruiz@correo.ar', role: 'val', active: true, last: 'Hoy' },
  { name: 'Tomás Bianchi', email: 't.bianchi@correo.ar', role: 'donor', active: false, last: 'Hace 2 meses' },
];

const ROLE_PILL = {
  donor: ['role-donor', 'Donante'],
  org: ['role-org', 'Admin. Organización'],
  val: ['role-val', 'Validador'],
  super: ['role-super', 'Super Admin'],
};

function ScreenUsers() {
  const checked = [0, 2, 5];
  return (
    <AdminShell active="Usuarios" title="Gestión de usuarios"
      subtitle="Administrá roles, permisos y estados de las cuentas de la plataforma"
      role="Super Admin" name="Carla Vega" tint={4}
      actions={<button className="btn btn--primary"><Icon name="plus" size={18} color="#fff" /> Invitar usuario</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, height: '100%' }}>
        {/* bulk bar */}
        <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--straw)', boxShadow: 'none' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--earth)' }}>{checked.length} seleccionados</span>
          <div style={{ width: 1, height: 24, background: 'rgba(122,42,8,.15)' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)' }}>Asignar rol:</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(ROLE_PILL).map(([k, [v, l]]) => (
              <span key={k} style={{ cursor: 'pointer' }}><Pill variant={v}>{l}</Pill></span>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn btn--secondary btn--sm">Activar</button>
          <button className="btn btn--sm" style={{ background: '#fff', color: 'var(--urgent)', boxShadow: 'inset 0 0 0 1.6px var(--bad-bg)' }}>Desactivar</button>
        </div>

        {/* table */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '36px 2.4fr 1.7fr 1fr 1fr 60px', gap: 12, padding: '15px 24px',
            borderBottom: '1px solid var(--line)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', alignItems: 'center' }}>
            <span style={{ width: 19, height: 19, borderRadius: 6, border: '2px solid var(--line)' }} />
            <span>Usuario</span><span>Rol</span><span>Estado</span><span>Actividad</span><span></span>
          </div>
          {USERS.map((u, i) => {
            const [v, l] = ROLE_PILL[u.role];
            const sel = checked.includes(i);
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 2.4fr 1.7fr 1fr 1fr 60px', gap: 12, padding: '13px 24px',
                borderBottom: i < USERS.length - 1 ? '1px solid var(--line-soft)' : 'none', alignItems: 'center',
                background: sel ? '#FBF1E2' : 'transparent' }}>
                <span style={{ width: 19, height: 19, borderRadius: 6, flex: '0 0 auto',
                  border: sel ? 'none' : '2px solid var(--line)', background: sel ? 'var(--horn)' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {sel && <Icon name="check" size={13} color="#fff" sw={3} />}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar name={u.name} size={42} tintIndex={i} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{u.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700 }}>{u.email}</div>
                  </div>
                </div>
                <span><Pill variant={v}>{l}</Pill></span>
                <span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 13.5,
                    color: u.active ? 'var(--ok)' : 'var(--ink-3)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.active ? 'var(--ok)' : 'var(--ink-3)' }} />
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>{u.last}</span>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn--ghost btn--sm" style={{ padding: '8px 10px' }}><Icon name="dots" size={18} color="var(--ink-3)" /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}

window.ScreenUsers = ScreenUsers;
