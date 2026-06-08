/* shared.jsx — El Hornero shared UI atoms (exported to window) */

/* ── Icon set (simple stroke icons) ─────────────────────────── */
const ICON_PATHS = {
  search:   '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  pin:      '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  heart:    '<path d="M12 20s-7-4.6-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7-2.5C19 9.4 12 20 12 20z"/>',
  check:    '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x:        '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron:  '<path d="M9 6l6 6-6 6"/>',
  chevd:    '<path d="M6 9l6 6 6-6"/>',
  filter:   '<path d="M4 6h16M7 12h10M10 18h4"/>',
  bell:     '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  dots:     '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  route:    '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.4 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.6"/>',
  eye:      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
  user:     '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  users:    '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.2 2.7-5.4 6-5.4s6 2.2 6 5.4"/><path d="M16 5.2A3.2 3.2 0 0 1 18 11M21 19c0-2.6-1.6-4.6-4-5.2"/>',
  mail:     '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 9.5h16M9 3.5v3M15 3.5v3"/>',
  building: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20v-3.5h4V20"/>',
  box:      '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  star:     '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z"/>',
  arrowr:   '<path d="M5 12h14M13 6l6 6-6 6"/>',
  grid:     '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
  layers:   '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
  shield:   '<path d="M12 3l7 3v5c0 5-3.4 8-7 9-3.6-1-7-4-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  edit:     '<path d="M14 5l5 5M4 20l1-4L16 5l3 3L8 19l-4 1z"/>',
  trash:    '<path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"/>',
  upload:   '<path d="M12 15V4M8 8l4-4 4 4M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4M5 19h14"/>',
  truck:    '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  spoon:    '<path d="M12 13c2.5 0 4-2 4-4.5S14.5 4 12 4 8 6 8 8.5 9.5 13 12 13zM12 13v7"/>',
  bread:    '<path d="M5 10a4 4 0 0 1 4-4h6a4 4 0 0 1 0 8H9a4 4 0 0 1-4-4z"/><path d="M9 6v8M13 6v8"/>',
};

function Icon({ name, size = 20, sw = 1.9, color, style, fill }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'}
      stroke={color || 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={style} dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || '' }} />
  );
}

/* ── Pill ───────────────────────────────────────────────────── */
function Pill({ variant = 'cat', dot, children, style }) {
  return (
    <span className={`pill pill--${variant}`} style={style}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

/* ── Stars (rating) — sun color only ────────────────────────── */
function Stars({ value = 0, size = 15, showNum = true }) {
  const full = Math.round(value);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-flex', gap: 1.5 }}>
        {[0,1,2,3,4].map(i => (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24"
            fill={i < full ? 'var(--sun)' : 'none'} stroke="var(--sun)" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z" />
          </svg>
        ))}
      </span>
      {showNum && <span style={{ fontSize: size - 2, fontWeight: 800, color: '#A6810D', marginLeft: 2 }}>{value.toFixed(1)}</span>}
    </span>
  );
}

/* ── Progress bar ───────────────────────────────────────────── */
function Progress({ value, max, height = 9 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return <div className="prog" style={{ height }}><i style={{ width: pct + '%' }} /></div>;
}

/* ── Avatar (initials) ──────────────────────────────────────── */
const AVA_TINTS = ['#C85A20', '#B5781E', '#3E8E5A', '#1C6E96', '#9A5B3B', '#7A2A08'];
function Avatar({ name = '', size = 40, tintIndex }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const bg = tintIndex != null ? AVA_TINTS[tintIndex % AVA_TINTS.length] : 'var(--horn)';
  return (
    <span className="ava" style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}>{initials}</span>
  );
}

/* ── Image / map / illustration placeholders ────────────────── */
function Placeholder({ label, w = '100%', h = 120, style, radius = 0 }) {
  return <div className="ph" style={{ width: w, height: h, borderRadius: radius, ...style }}>{label}</div>;
}

/* Map placeholder — striped field + faux roads + drop pins */
function MapPlaceholder({ pins = [], style, markerStyle = 'pin' }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: '#EDE7DC', ...style }}>
      {/* faux landmass tint */}
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(122,42,8,.035) 0 14px, transparent 14px 28px)' }} />
      {/* faux roads */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} preserveAspectRatio="none">
        <g stroke="#fff" strokeWidth="9" fill="none" opacity="0.9">
          <path d="M-20 120 L520 60" /><path d="M-20 320 L640 280" /><path d="M120 -20 L240 700" />
          <path d="M420 -20 L520 700" /><path d="M-20 520 L700 440" />
        </g>
        <g stroke="#E4DCCE" strokeWidth="2" fill="none">
          <path d="M-20 120 L520 60" /><path d="M-20 320 L640 280" /><path d="M120 -20 L240 700" />
          <path d="M420 -20 L520 700" /><path d="M-20 520 L700 440" />
        </g>
        {/* a faint river in sky tone */}
        <path d="M-20 220 C 180 260, 280 120, 700 200" stroke="#BFE0EE" strokeWidth="16" fill="none" opacity="0.7" />
      </svg>
      {/* monospace label chip */}
      <div style={{ position: 'absolute', left: 16, bottom: 16, fontFamily: '"DM Mono", monospace',
        fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B8E7E',
        background: 'rgba(255,255,255,.85)', padding: '6px 10px', borderRadius: 8 }}>
        ⬡ Mapa interactivo · componente
      </div>
      {pins.map((p, i) => <MapMarker key={i} {...p} variant={markerStyle} />)}
    </div>
  );
}

/* Map markers — three variants for the Home exploration */
function MapMarker({ x, y, active, count, label, variant = 'pin' }) {
  const c = active ? 'var(--sky)' : 'var(--horn)';
  if (variant === 'dot') {
    return (
      <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)' }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: c, boxShadow: '0 0 0 4px #fff, 0 3px 8px rgba(0,0,0,.2)' }} />
      </div>
    );
  }
  if (variant === 'spoon') {
    return (
      <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-100%)',
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.25))' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50% 50% 50% 6px', background: c, transform: 'rotate(45deg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: 'rotate(-45deg)', color: '#fff', display: 'flex' }}>
            <Icon name="spoon" size={20} sw={2} color="#fff" />
          </div>
        </div>
      </div>
    );
  }
  /* default teardrop pin */
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-100%)',
      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.28))' }}>
      <svg width="34" height="44" viewBox="0 0 34 44">
        <path d="M17 0C8 0 1 7 1 16c0 11 16 28 16 28s16-17 16-28C33 7 26 0 17 0z" fill={c} />
        <circle cx="17" cy="16" r="6.5" fill="#fff" />
      </svg>
      {count != null && (
        <div style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, padding: '0 5px',
          borderRadius: 10, background: 'var(--earth)', color: '#fff', fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{count}</div>
      )}
    </div>
  );
}

/* ── Hornero illustration placeholder (labeled) ─────────────── */
/* style: 'box' | 'circle' | 'nest' — the variation set explores framings */
function Hornero({ variant = 'box', size = 120, label = 'ILUSTRACIÓN · HORNERO', style }) {
  const base = {
    background: '#F6ECDC',
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(200,90,32,.10) 0 9px, transparent 9px 18px)',
    border: '2px dashed rgba(200,90,32,.4)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 8, textAlign: 'center', color: 'var(--horn)',
  };
  const mono = { fontFamily: '"DM Mono", monospace', fontSize: 10.5, letterSpacing: '.06em', color: '#A0673E' };
  if (variant === 'circle') {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', ...base, ...style }}>
        <Icon name="pin" size={size * 0.26} sw={1.6} color="var(--horn)" />
        <span style={mono}>{label}</span>
      </div>
    );
  }
  if (variant === 'nest') {
    return (
      <div style={{ width: size, height: size * 0.78, borderRadius: '40% 40% 46% 46% / 60% 60% 40% 40%', ...base, ...style }}>
        <span style={{ fontSize: size * 0.2 }}>🪺</span>
        <span style={mono}>{label}</span>
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 18, ...base, ...style }}>
      <svg width={size * 0.34} height={size * 0.34} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 14c0-4 3-7 7-7 2 0 4 1 4 1l3-2-1 3s1 2 1 4c0 4-3 7-7 7" />
        <circle cx="10" cy="11" r="1" fill="var(--horn)" stroke="none" />
        <path d="M5 14c-1 2-2 3-3 3 1 1 3 1 4 0" />
      </svg>
      <span style={mono}>{label}</span>
    </div>
  );
}

Object.assign(window, { Icon, Pill, Stars, Progress, Avatar, Placeholder, MapPlaceholder, MapMarker, Hornero });
