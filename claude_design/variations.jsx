/* variations.jsx — exploration sets for the canvas */

/* ════════ 1 · EMPTY STATES (Hornero illustration) ════════ */
function EmptyState({ variant, hero, title, body, cta }) {
  return (
    <div className="eh" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', padding: '40px 36px', gap: 6 }}>
      <Hornero variant={variant} size={132} label="ILUSTRACIÓN · HORNERO" style={{ marginBottom: 18 }} />
      <h2 style={{ fontSize: 21, fontWeight: 900 }}>{title}</h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 14.5, fontWeight: 600, lineHeight: 1.55, maxWidth: 300, marginTop: 4 }}>{body}</p>
      <button className="btn btn--primary" style={{ marginTop: 18 }}>{cta}</button>
    </div>
  );
}

function VarEmptyA() {
  return <EmptyState variant="box" title="Todavía no hay comedores acá"
    body="Aún no encontramos organizaciones en esta zona de Córdoba. ¿Conocés una? Ayudanos a sumarla al mapa."
    cta={<><Icon name="plus" size={17} color="#fff" /> Sumar un comedor</>} />;
}
function VarEmptyB() {
  return <EmptyState variant="circle" title="Empezá a ayudar hoy"
    body="Todavía no hiciste ninguna donación. Explorá las necesidades cerca tuyo y dale una mano a tu barrio."
    cta={<><Icon name="heart" size={17} color="#fff" /> Ver necesidades</>} />;
}
function VarEmptyC() {
  return <EmptyState variant="nest" title="Tu nido está tranquilo"
    body="No tenés alertas nuevas. Cuando un comedor de tus zonas publique una necesidad, te avisamos acá."
    cta={<><Icon name="bell" size={17} color="#fff" /> Configurar alertas</>} />;
}

/* ════════ 2 · BADGE / PILL SYSTEMS ════════ */
function badgeStyle(kind, mode) {
  /* kind tokens → [color, soft-bg] */
  const C = {
    open: ['#1C6E96', '#D9EEF8'], closed: ['#8A8178', '#ECE5DB'],
    urgent: ['#C0392B', '#F7DAD5'], medium: ['#B5781E', '#F6E4C4'], normal: ['#8A6A3A', '#F2D5B0'],
    cat: ['#8A6A3A', '#F2D5B0'], ok: ['#3E8E5A', '#D7ECDD'],
  }[kind];
  const [fg, bg] = C;
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, fontWeight: 800, fontSize: 12.5, lineHeight: 1, padding: '7px 13px', whiteSpace: 'nowrap' };
  if (mode === 'soft') return { ...base, color: fg, background: bg };
  if (mode === 'outline') return { ...base, color: fg, background: 'transparent', boxShadow: `inset 0 0 0 1.6px ${fg}` };
  if (mode === 'solid') return { ...base, color: '#fff', background: fg };
  return base;
}
function B({ kind, mode, dot, children }) {
  const fg = { open: '#1C6E96', closed: '#8A8178', urgent: '#C0392B', medium: '#B5781E', normal: '#8A6A3A', cat: '#8A6A3A', ok: '#3E8E5A' }[kind];
  return (
    <span style={badgeStyle(kind, mode)}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: mode === 'solid' ? '#fff' : fg }} />}
      {children}
    </span>
  );
}
function BadgeSystem({ mode, name, note }) {
  const Group = ({ label, children }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  );
  return (
    <div className="eh" style={{ height: '100%', padding: '26px 28px' }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900 }}>{name}</h2>
        <p style={{ color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{note}</p>
      </div>
      <Group label="Estado abierto / cerrado">
        <B kind="open" mode={mode} dot>Abierto</B>
        <B kind="closed" mode={mode} dot>Cerrado</B>
      </Group>
      <Group label="Prioridad de necesidad">
        <B kind="urgent" mode={mode}>Urgente</B>
        <B kind="medium" mode={mode}>Media</B>
        <B kind="normal" mode={mode}>Normal</B>
      </Group>
      <Group label="Categorías">
        <B kind="cat" mode={mode}>Almuerzo</B>
        <B kind="cat" mode={mode}>Merienda</B>
        <B kind="cat" mode={mode}>Desayuno</B>
        <B kind="cat" mode={mode}>Donaciones</B>
      </Group>
      <Group label="Estado de validación">
        <B kind="medium" mode={mode} dot>Pendiente</B>
        <B kind="ok" mode={mode} dot>Aprobada</B>
        <B kind="urgent" mode={mode} dot>Rechazada</B>
      </Group>
      <Group label="Donación">
        <B kind="ok" mode={mode} dot>Recibido</B>
        <B kind="medium" mode={mode} dot>En camino</B>
        <B kind="open" mode={mode} dot>Entregado</B>
      </Group>
    </div>
  );
}
function VarBadgeSoft()    { return <BadgeSystem mode="soft"    name="A · Suave" note="Relleno tenue. Cálido y amable — el estilo por defecto." />; }
function VarBadgeOutline() { return <BadgeSystem mode="outline" name="B · Contorno" note="Solo borde. Más liviano, menos color en pantalla." />; }
function VarBadgeSolid()   { return <BadgeSystem mode="solid"   name="C · Sólido" note="Relleno pleno. Más contraste y jerarquía fuerte." />; }

/* ════════ 3 · MAP MARKERS + BOTTOM-SHEET CARDS ════════ */
function MarkerExploration({ markerStyle, render }) {
  const pins = [
    { x: '26%', y: '32%', active: false, count: markerStyle === 'pin' ? 3 : null },
    { x: '54%', y: '50%', active: true },
    { x: '70%', y: '30%', active: false },
    { x: '40%', y: '68%', active: false },
    { x: '80%', y: '60%', active: false },
  ];
  return (
    <div className="eh" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <MapPlaceholder pins={pins} markerStyle={markerStyle} />
      {render}
    </div>
  );
}

/* A — teardrop pins + horizontal card strip */
function VarMapA() {
  return (
    <MarkerExploration markerStyle="pin" render={
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--adobe)',
        borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: '0 -8px 30px rgba(122,42,8,.14)', padding: '12px 18px 18px' }}>
        <div style={{ width: 44, height: 5, borderRadius: 999, background: 'var(--line)', margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', gap: 14, overflow: 'hidden' }}>
          {HOME_ORGS.slice(0, 2).map((o, i) => <HomeCard key={i} o={o} style={{ width: 260 }} />)}
        </div>
      </div>
    } />
  );
}

/* B — dot markers + compact list rows */
function VarMapB() {
  return (
    <MarkerExploration markerStyle="dot" render={
      <div style={{ position: 'absolute', left: 16, top: 16, bottom: 16, width: 280, background: 'var(--card)',
        borderRadius: 18, boxShadow: 'var(--sh-2)', padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--earth)', padding: '4px 6px 10px' }}>12 lugares cerca</div>
        {HOME_ORGS.map((o, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 8px', borderRadius: 12,
            background: i === 1 ? 'var(--card-2)' : 'transparent' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', flex: '0 0 auto', background: o.open ? 'var(--sky)' : 'var(--horn)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>{o.dist} · {o.addr}</div>
            </div>
            <Stars value={o.rating} size={12} showNum={false} />
          </div>
        ))}
      </div>
    } />
  );
}

/* C — spoon markers + single featured detail card */
function VarMapC() {
  const o = HOME_ORGS[0];
  return (
    <MarkerExploration markerStyle="spoon" render={
      <div style={{ position: 'absolute', right: 18, bottom: 18, width: 300, background: 'var(--card)',
        borderRadius: 20, boxShadow: 'var(--sh-pop)', overflow: 'hidden' }}>
        <Placeholder label="FOTO DEL COMEDOR" h={120} />
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Pill variant="open" dot>Abierto</Pill>
            <Pill variant="cat">Almuerzo</Pill>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 900 }}>{o.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 14px', color: 'var(--ink-2)', fontSize: 13, fontWeight: 700 }}>
            <Icon name="pin" size={14} color="var(--ink-3)" /> {o.addr} · {o.dist}
            <span style={{ marginLeft: 'auto' }}><Stars value={o.rating} size={13} /></span>
          </div>
          <button className="btn btn--primary btn--block"><Icon name="route" size={16} color="#fff" /> Cómo llegar</button>
        </div>
      </div>
    } />
  );
}

Object.assign(window, {
  VarEmptyA, VarEmptyB, VarEmptyC,
  VarBadgeSoft, VarBadgeOutline, VarBadgeSolid,
  VarMapA, VarMapB, VarMapC,
});
