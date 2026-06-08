/* screen_admin.jsx — Admin dashboard · organization validation */

const ADMIN_ORGS = [
  { name: 'Comedor Los Hornitos', city: 'Córdoba Capital', cat: 'Almuerzo', date: '28 May', status: 'pending', by: 'R. Sosa' },
  { name: 'Merendero El Nido', city: 'Villa María', cat: 'Merienda', date: '27 May', status: 'pending', by: 'L. Pérez' },
  { name: 'Copa de Leche San Vicente', city: 'Córdoba Capital', cat: 'Merienda', date: '26 May', status: 'approved', by: 'M. Díaz' },
  { name: 'Comedor Manos Abiertas', city: 'Río Cuarto', cat: 'Donaciones', date: '25 May', status: 'pending', by: 'A. Luna' },
  { name: 'Olla Popular La Esperanza', city: 'Alta Gracia', cat: 'Almuerzo', date: '24 May', status: 'approved', by: 'C. Vega' },
  { name: 'Merendero Sol Naciente', city: 'Carlos Paz', cat: 'Desayuno', date: '23 May', status: 'rejected', by: 'P. Ruiz' },
];

function StatCard({ label, value, delta, tone }) {
  const tones = { horn: 'var(--horn)', warn: 'var(--medium)', ok: 'var(--ok)', bad: 'var(--urgent)' };
  return (
    <div className="card" style={{ flex: 1, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink-2)' }}>{label}</span>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: tones[tone] }} />
      </div>
      <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--earth)', marginTop: 8, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginTop: 8 }}>{delta}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const m = { pending: ['warn', 'Pendiente'], approved: ['ok', 'Aprobada'], rejected: ['bad', 'Rechazada'] };
  const [v, l] = m[status];
  return <Pill variant={v} dot>{l}</Pill>;
}

function FilterBar({ groups }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      {groups.map((g, gi) => (
        <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{g.label}</span>
          {g.opts.map((o, i) => (
            <span key={o} style={{ padding: '8px 13px', borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: 'pointer',
              background: i === g.active ? 'var(--earth)' : 'var(--card-2)', color: i === g.active ? '#fff' : 'var(--ink-2)' }}>{o}</span>
          ))}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', boxShadow: 'none', border: '1.5px solid var(--line)' }}>
        <Icon name="search" size={17} color="var(--ink-3)" />
        <input className="input" placeholder="Buscar organización…" style={{ border: 'none', padding: 0, width: 180, background: 'transparent', fontWeight: 600 }} />
      </div>
    </div>
  );
}

function ScreenAdmin() {
  return (
    <AdminShell active="Organizaciones" title="Validación de organizaciones"
      subtitle="Revisá y aprobá los comedores que se postulan a la plataforma"
      actions={<button className="btn btn--primary"><Icon name="plus" size={18} color="#fff" /> Nueva organización</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, height: '100%' }}>
        {/* stats */}
        <div style={{ display: 'flex', gap: 18 }}>
          <StatCard label="Total" value="148" delta="+12 este mes" tone="horn" />
          <StatCard label="Pendientes" value="9" delta="Requieren revisión" tone="warn" />
          <StatCard label="Aprobadas" value="132" delta="89% del total" tone="ok" />
          <StatCard label="Rechazadas" value="7" delta="Datos incompletos" tone="bad" />
        </div>

        {/* filters */}
        <FilterBar groups={[
          { label: 'Estado', active: 0, opts: ['Todas', 'Pendientes', 'Aprobadas', 'Rechazadas'] },
          { label: 'Ciudad', active: 0, opts: ['Toda Córdoba', 'Capital', 'Interior'] },
        ]} />

        {/* table */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.3fr 1fr 0.9fr 1fr 1.4fr', gap: 12, padding: '16px 24px',
            borderBottom: '1px solid var(--line)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            <span>Organización</span><span>Ciudad</span><span>Categoría</span><span>Alta</span><span>Estado</span><span style={{ textAlign: 'right' }}>Acciones</span>
          </div>
          {ADMIN_ORGS.map((o, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.3fr 1fr 0.9fr 1fr 1.4fr', gap: 12, padding: '14px 24px',
              borderBottom: i < ADMIN_ORGS.length - 1 ? '1px solid var(--line-soft)' : 'none', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <Hornero variant="box" size={40} label="" style={{ flex: '0 0 auto', borderRadius: 10 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700 }}>Postuló: {o.by}</div>
                </div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-2)' }}>{o.city}</span>
              <span><Pill variant="cat">{o.cat}</Pill></span>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-2)' }}>{o.date}</span>
              <span><StatusPill status={o.status} /></span>
              <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                <button className="btn btn--secondary btn--sm" style={{ padding: '8px 11px' }}><Icon name="eye" size={16} color="var(--ink-2)" /></button>
                {o.status === 'pending' ? (
                  <>
                    <button className="btn btn--sm" style={{ background: 'var(--ok-bg)', color: 'var(--ok)', padding: '8px 12px' }}><Icon name="check" size={16} color="var(--ok)" /> Aprobar</button>
                    <button className="btn btn--sm" style={{ background: 'var(--bad-bg)', color: 'var(--urgent)', padding: '8px 12px' }}><Icon name="x" size={16} color="var(--urgent)" /></button>
                  </>
                ) : (
                  <button className="btn btn--ghost btn--sm" style={{ padding: '8px 11px' }}><Icon name="dots" size={16} color="var(--ink-3)" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

window.ScreenAdmin = ScreenAdmin;
