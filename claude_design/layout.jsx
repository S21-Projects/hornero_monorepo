/* layout.jsx — El Hornero nav shells (exported to window) */

function Logo({ size = 34 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: size, height: size, borderRadius: 10, background: 'var(--horn)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
        boxShadow: '0 2px 0 #A8481699' }}>
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 14c0-4 3-7 7-7 2 0 4 1 4 1l3-2-1 3s1 2 1 4c0 4-3 7-7 7" />
          <circle cx="10" cy="11" r="0.9" fill="#fff" stroke="none" />
          <path d="M5 14c-1 2-2 3-3 3 1 1 3 1 4 0" />
        </svg>
      </div>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontWeight: 900, fontSize: size * 0.5, color: 'var(--earth)', letterSpacing: '-.02em' }}>El Hornero</div>
        <div style={{ fontSize: size * 0.27, color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '.04em', marginTop: 2 }}>Comedores · Córdoba</div>
      </div>
    </div>
  );
}

/* Top app bar for donor-facing screens */
function TopBar({ active = 'Mapa', role = 'Donante', name = 'María Belén', tint = 0 }) {
  const items = ['Mapa', 'Donaciones', 'Necesidades', 'Preferencias'];
  return (
    <header style={{ height: 70, background: 'var(--card)', borderBottom: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', gap: 28, padding: '0 28px', flex: '0 0 auto', position: 'relative', zIndex: 5 }}>
      <Logo />
      <nav style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
        {items.map(it => (
          <span key={it} style={{ position: 'relative', padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
            fontWeight: 800, fontSize: 14.5,
            color: it === active ? 'var(--horn)' : 'var(--ink-2)',
            background: it === active ? '#F6E0CF' : 'transparent' }}>{it}</span>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <button className="btn btn--secondary btn--sm" style={{ gap: 7 }}>
        <Icon name="bell" size={17} color="var(--ink-2)" />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 6 }}>
        <Avatar name={name} size={38} tintIndex={tint} />
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--earth)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>{role}</div>
        </div>
        <Icon name="chevd" size={16} color="var(--ink-3)" />
      </div>
    </header>
  );
}

/* Admin shell: left sidebar + top strip; children render in main area */
function AdminShell({ active = 'Organizaciones', title, subtitle, actions, role = 'Validador', name = 'Diego Funes', tint = 2, children }) {
  const nav = [
    { label: 'Panel', icon: 'grid' },
    { label: 'Organizaciones', icon: 'building' },
    { label: 'Necesidades', icon: 'box' },
    { label: 'Usuarios', icon: 'users' },
    { label: 'Analíticas', icon: 'layers' },
    { label: 'Ajustes', icon: 'settings' },
  ];
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: 'var(--adobe)' }}>
      {/* sidebar */}
      <aside style={{ width: 248, flex: '0 0 auto', background: 'var(--card)', borderRight: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', padding: '22px 16px' }}>
        <div style={{ padding: '0 8px 22px' }}><Logo /></div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {nav.map(n => (
            <div key={n.label} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 11,
              cursor: 'pointer', fontWeight: 800, fontSize: 14.5,
              color: n.label === active ? '#fff' : 'var(--ink-2)',
              background: n.label === active ? 'var(--horn)' : 'transparent' }}>
              <Icon name={n.icon} size={19} color={n.label === active ? '#fff' : 'var(--ink-3)'} sw={1.9} />
              {n.label}
            </div>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ background: 'var(--card-2)', borderRadius: 14, padding: 14, display: 'flex', gap: 11, alignItems: 'center' }}>
          <Avatar name={name} size={40} tintIndex={tint} />
          <div style={{ lineHeight: 1.3, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--earth)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <Pill variant="role-val" style={{ fontSize: 11, padding: '4px 9px', marginTop: 3 }}>{role}</Pill>
          </div>
        </div>
      </aside>
      {/* main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ padding: '24px 32px 20px', display: 'flex', alignItems: 'flex-end', gap: 20,
          borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900 }}>{title}</h1>
            {subtitle && <p style={{ color: 'var(--ink-2)', fontSize: 14.5, marginTop: 5, fontWeight: 600 }}>{subtitle}</p>}
          </div>
          {actions}
        </header>
        <div style={{ flex: 1, overflow: 'hidden', padding: '24px 32px' }}>{children}</div>
      </div>
    </div>
  );
}

Object.assign(window, { Logo, TopBar, AdminShell });
