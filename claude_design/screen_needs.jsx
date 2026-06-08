/* screen_needs.jsx — Donation needs board (card grid) */

const NEEDS = [
  { org: 'Comedor Los Hornitos', title: 'Leche en polvo', cat: 'Almuerzo', priority: 'urgent', exp: 'Vence en 3 días', have: 18, need: 40, unit: 'kg', done: false },
  { org: 'Merendero El Nido', title: 'Cacao y azúcar', cat: 'Merienda', priority: 'medium', exp: 'Vence en 9 días', have: 24, need: 30, unit: 'kg', done: false },
  { org: 'Copa de Leche San Vicente', title: 'Pan y galletitas', cat: 'Merienda', priority: 'normal', exp: 'Vence en 14 días', have: 8, need: 50, unit: 'paq', done: false },
  { org: 'Comedor Manos Abiertas', title: 'Fideos y arroz', cat: 'Almuerzo', priority: 'urgent', exp: 'Vence en 2 días', have: 60, need: 100, unit: 'kg', done: false },
  { org: 'Olla La Esperanza', title: 'Verduras frescas', cat: 'Almuerzo', priority: 'medium', exp: 'Vence en 6 días', have: 25, need: 30, unit: 'cajón', done: false },
  { org: 'Merendero Sol Naciente', title: 'Yerba mate', cat: 'Desayuno', priority: 'normal', exp: 'Completada', have: 40, need: 40, unit: 'kg', done: true },
];

function NeedCard({ n }) {
  const pv = { urgent: 'urgent', medium: 'medium', normal: 'normal' }[n.priority];
  const pl = { urgent: 'Urgente', medium: 'Media', normal: 'Normal' }[n.priority];
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, opacity: n.done ? 0.7 : 1,
      border: n.done ? '1.5px solid var(--ok)' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {n.done ? <Pill variant="ok" dot><Icon name="check" size={13} /> Cumplida</Pill> : <Pill variant={pv}>{pl}</Pill>}
          <Pill variant="cat">{n.cat}</Pill>
        </div>
        <Icon name="dots" size={18} color="var(--ink-3)" />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)', fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
          <Hornero variant="circle" size={26} label="" style={{ flex: '0 0 auto' }} /> {n.org}
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 900 }}>{n.title}</h3>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>
          <span style={{ color: 'var(--horn)' }}>{n.have} {n.unit}</span>
          <span style={{ color: 'var(--ink-3)' }}>de {n.need} {n.unit}</span>
        </div>
        <Progress value={n.have} max={n.need} height={10} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
          color: n.priority === 'urgent' && !n.done ? 'var(--urgent)' : 'var(--ink-3)' }}>
          <Icon name="calendar" size={15} /> {n.exp}
        </span>
        {n.done
          ? <button className="btn btn--secondary btn--sm">Ver aportes</button>
          : <button className="btn btn--primary btn--sm"><Icon name="heart" size={15} color="#fff" /> Donar</button>}
      </div>
    </div>
  );
}

function ScreenNeeds() {
  return (
    <div className="eh" style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar active="Necesidades" />
      <div style={{ flex: 1, overflow: 'hidden', padding: '28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900 }}>Tablero de necesidades</h1>
            <p style={{ color: 'var(--ink-2)', fontSize: 15, marginTop: 5, fontWeight: 600 }}>34 pedidos activos de comedores de Córdoba esperan tu ayuda</p>
          </div>
          <button className="btn btn--secondary"><Icon name="check" size={18} color="var(--earth)" /> Marcar como cumplida</button>
        </div>

        {/* filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Categoría</span>
            {['Todas', 'Almuerzo', 'Merienda', 'Desayuno', 'Donaciones'].map((o, i) => (
              <span key={o} style={{ padding: '8px 14px', borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                background: i === 0 ? 'var(--earth)' : 'var(--card)', color: i === 0 ? '#fff' : 'var(--ink-2)', boxShadow: i === 0 ? 'none' : 'var(--sh-1)' }}>{o}</span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Urgencia</span>
            {['Todas', 'Urgente', 'Media', 'Normal'].map((o, i) => (
              <span key={o} style={{ padding: '8px 14px', borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                background: i === 0 ? 'var(--earth)' : 'var(--card)', color: i === 0 ? '#fff' : 'var(--ink-2)', boxShadow: i === 0 ? 'none' : 'var(--sh-1)' }}>{o}</span>
            ))}
          </div>
        </div>

        {/* grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {NEEDS.map((n, i) => <NeedCard key={i} n={n} />)}
        </div>
      </div>
    </div>
  );
}

window.ScreenNeeds = ScreenNeeds;
window.NeedCard = NeedCard;
