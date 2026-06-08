/* screen_detail.jsx — Organization detail page (desktop) */

function NeedRow({ title, sub, priority, progress }) {
  const pv = { urgent: 'urgent', medium: 'medium', normal: 'normal' }[priority];
  const pl = { urgent: 'Urgente', medium: 'Media', normal: 'Normal' }[priority];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--card-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <Icon name="box" size={22} color="var(--horn)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h4 style={{ fontSize: 15.5, fontWeight: 800 }}>{title}</h4>
          <Pill variant={pv}>{pl}</Pill>
        </div>
        <p style={{ color: 'var(--ink-2)', fontSize: 13.5, marginTop: 4, fontWeight: 600 }}>{sub}</p>
      </div>
      <div style={{ width: 150, flex: '0 0 auto' }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 6, textAlign: 'right' }}>{progress[0]}/{progress[1]}</div>
        <Progress value={progress[0]} max={progress[1]} />
      </div>
    </div>
  );
}

function DonationRow({ who, what, date, status }) {
  const map = { received: ['ok', 'Recibido', 'check'], transit: ['warn', 'En camino', 'truck'], delivered: ['open', 'Entregado', 'shield'] };
  const [v, label, icon] = map[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <Avatar name={who} size={40} tintIndex={who.length % 6} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{who}</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 13, fontWeight: 600 }}>{what}</div>
      </div>
      <div style={{ color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 700, marginRight: 8 }}>{date}</div>
      <Pill variant={v} dot><Icon name={icon} size={13} /> {label}</Pill>
    </div>
  );
}

function ScreenDetail() {
  return (
    <div className="eh" style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar active="Mapa" />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/* hero */}
        <div style={{ position: 'relative', height: 240 }}>
          <Placeholder label="FOTO DE PORTADA · COMEDOR" h="100%" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(200,90,32,.30) 0%, rgba(122,42,8,.82) 100%)' }} />
          <div style={{ position: 'absolute', left: 40, bottom: 26, right: 40, display: 'flex', alignItems: 'flex-end', gap: 20 }}>
            <Hornero variant="box" size={96} label="LOGO" style={{ border: '3px solid #fff', boxShadow: 'var(--sh-2)' }} />
            <div style={{ flex: 1, color: '#fff', paddingBottom: 4 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <Pill variant="open" dot>Abierto · cierra 15:00</Pill>
                <Pill variant="solid" style={{ background: 'rgba(255,255,255,.22)' }}>Validado</Pill>
              </div>
              <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 900 }}>Comedor Los Hornitos</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontWeight: 700, fontSize: 14.5, opacity: .95 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="pin" size={16} color="#fff" /> Av. Colón 1240, B° Alberdi</span>
                <Stars value={4.8} showNum />
              </div>
            </div>
          </div>
        </div>

        {/* body: two columns */}
        <div style={{ display: 'flex', gap: 28, padding: '28px 40px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
            {/* schedule + about */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Sobre el comedor</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, fontWeight: 600 }}>
                Atendemos a más de 180 familias del barrio Alberdi con almuerzo diario y copa de leche por la tarde.
                Funcionamos hace 12 años gracias a vecinos y donantes de toda Córdoba.
              </p>
              <div style={{ display: 'flex', gap: 28, marginTop: 18, flexWrap: 'wrap' }}>
                {[['clock', 'Almuerzo', 'Lun a Vie · 12:00–15:00'], ['clock', 'Merienda', 'Lun a Sáb · 16:30–18:00'], ['mail', 'Contacto', 'hornitos@correo.ar']].map(([ic, t, s]) => (
                  <div key={t} style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--card-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={ic} size={20} color="var(--horn)" />
                    </div>
                    <div><div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700 }}>{t}</div><div style={{ fontWeight: 800, fontSize: 14 }}>{s}</div></div>
                  </div>
                ))}
              </div>
            </div>

            {/* active needs */}
            <div className="card" style={{ padding: '20px 24px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900 }}>Necesidades activas</h3>
                <Pill variant="ghost">4 abiertas</Pill>
              </div>
              <NeedRow title="Leche en polvo" sub="Para la copa de leche de la tarde" priority="urgent" progress={[18, 40]} />
              <NeedRow title="Fideos y arroz" sub="Secos no perecederos · paquetes de 1kg" priority="medium" progress={[60, 100]} />
              <NeedRow title="Frutas y verduras" sub="Frescas, para el almuerzo semanal" priority="normal" progress={[25, 30]} />
              <NeedRow title="Útiles escolares" sub="Cuadernos, lápices y mochilas" priority="normal" progress={[12, 50]} />
            </div>

            {/* donation history */}
            <div className="card" style={{ padding: '20px 24px 8px' }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Donaciones recientes</h3>
              <DonationRow who="María Belén Ríos" what="20 kg de leche en polvo" date="Hoy · 11:20" status="transit" />
              <DonationRow who="Panadería La Esquina" what="Pan y facturas" date="Ayer" status="delivered" />
              <DonationRow who="Club Atlético Belgrano" what="Caja de fideos y arroz" date="Hace 2 días" status="received" />
              <DonationRow who="Familia Gómez" what="Frutas y verduras de estación" date="Hace 3 días" status="delivered" />
            </div>
          </div>

          {/* right rail CTA */}
          <div style={{ width: 320, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card" style={{ padding: 22, background: 'var(--straw)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Pill variant="urgent">Urgente</Pill>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 700 }}>vence en 3 días</span>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 900 }}>Leche en polvo</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 14, marginTop: 6, fontWeight: 600, lineHeight: 1.5 }}>18 de 40 kg reunidos. Cada aporte suma para la merienda de los chicos.</p>
              <div style={{ margin: '14px 0 18px' }}><Progress value={18} max={40} height={11} /></div>
              <button className="btn btn--primary btn--block" style={{ fontSize: 16 }}><Icon name="heart" size={18} color="#fff" /> Donar a esta necesidad</button>
              <button className="btn btn--ghost btn--block" style={{ marginTop: 8 }}><Icon name="route" size={17} color="var(--ink-2)" /> Cómo llegar</button>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <h4 style={{ fontSize: 15, fontWeight: 900, marginBottom: 12 }}>Ubicación</h4>
              <div style={{ borderRadius: 14, overflow: 'hidden', height: 150 }}><MapPlaceholder pins={[{ x: '50%', y: '50%', active: false }]} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenDetail = ScreenDetail;
