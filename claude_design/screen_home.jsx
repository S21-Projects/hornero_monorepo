/* screen_home.jsx — Home / map view (desktop) */

const HOME_ORGS = [
  { name: 'Comedor Los Hornitos', dist: '0,4 km', open: true, cats: ['Almuerzo', 'Merienda'], rating: 4.8, addr: 'B° Alberdi' },
  { name: 'Copa de Leche San Vicente', dist: '0,9 km', open: true, cats: ['Merienda', 'Donaciones'], rating: 4.6, addr: 'B° San Vicente' },
  { name: 'Merendero El Nido', dist: '1,6 km', open: false, cats: ['Merienda'], rating: 4.9, addr: 'B° Yofre' },
  { name: 'Comedor Manos Abiertas', dist: '2,1 km', open: true, cats: ['Almuerzo', 'Donaciones'], rating: 4.7, addr: 'B° General Paz' },
];

function HomeCard({ o, style }) {
  return (
    <div className="card" style={{ width: 290, flex: '0 0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Hornero variant="circle" size={54} label="FOTO" style={{ flex: '0 0 auto' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{o.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, color: 'var(--ink-2)', fontSize: 13, fontWeight: 700 }}>
            <Icon name="pin" size={14} color="var(--ink-3)" /> {o.addr} · {o.dist}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill variant={o.open ? 'open' : 'closed'} dot>{o.open ? 'Abierto' : 'Cerrado'}</Pill>
        {o.cats.map(c => <Pill key={c} variant="cat">{c}</Pill>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stars value={o.rating} />
        <button className="btn btn--primary btn--sm" style={{ gap: 6 }}>
          <Icon name="route" size={15} color="#fff" /> Cómo llegar
        </button>
      </div>
    </div>
  );
}

function ScreenHome() {
  const pins = [
    { x: '28%', y: '34%', active: false, count: 3 },
    { x: '52%', y: '52%', active: true },
    { x: '68%', y: '30%', active: false },
    { x: '44%', y: '70%', active: false, count: 2 },
    { x: '78%', y: '62%', active: false },
  ];
  const filters = ['Todos', 'Almuerzo', 'Merienda', 'Desayuno', 'Donaciones', 'Abierto ahora'];
  return (
    <div className="eh" style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar active="Mapa" />
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <MapPlaceholder pins={pins} />

        {/* floating search + filters */}
        <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 70%)',
          display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px 6px 18px', boxShadow: 'var(--sh-2)' }}>
            <Icon name="search" size={20} color="var(--ink-3)" />
            <input className="input" placeholder="Buscar comedores, merenderos o barrios en Córdoba…"
              style={{ border: 'none', padding: '12px 0', flex: 1, background: 'transparent', fontWeight: 600 }} />
            <button className="btn btn--primary btn--sm">Buscar</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filters.map((f, i) => (
              <span key={f} style={{ padding: '9px 15px', borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                background: i === 0 ? 'var(--earth)' : 'var(--card)', color: i === 0 ? '#fff' : 'var(--ink-2)',
                boxShadow: i === 0 ? 'none' : 'var(--sh-1)' }}>{f}</span>
            ))}
          </div>
        </div>

        {/* map controls */}
        <div style={{ position: 'absolute', right: 22, top: 100, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['plus', 'route'].map(ic => (
            <button key={ic} className="card" style={{ width: 44, height: 44, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name={ic === 'plus' ? 'plus' : 'pin'} size={20} color="var(--earth)" />
            </button>
          ))}
        </div>

        {/* bottom sheet — docked card strip */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0,
          background: 'var(--adobe)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
          boxShadow: '0 -8px 30px rgba(122,42,8,.12)', padding: '14px 28px 22px' }}>
          <div style={{ width: 48, height: 5, borderRadius: 999, background: 'var(--line)', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 900 }}>Cerca tuyo · <span style={{ color: 'var(--horn)' }}>12 lugares</span></h2>
            <span className="lnk" style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver lista completa <Icon name="arrowr" size={15} color="var(--sky)" /></span>
          </div>
          <div style={{ display: 'flex', gap: 16, overflow: 'hidden' }}>
            {HOME_ORGS.map((o, i) => <HomeCard key={i} o={o} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenHome = ScreenHome;
window.HomeCard = HomeCard;
window.HOME_ORGS = HOME_ORGS;
