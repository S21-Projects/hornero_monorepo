/* screen_prefs.jsx — Donor notification preferences */

function Toggle({ on }) {
  return (
    <span style={{ width: 46, height: 27, borderRadius: 999, background: on ? 'var(--sky)' : 'var(--line)',
      display: 'inline-flex', alignItems: 'center', padding: 3, flex: '0 0 auto', transition: 'background .15s',
      justifyContent: on ? 'flex-end' : 'flex-start' }}>
      <span style={{ width: 21, height: 21, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </span>
  );
}

function PrefRow({ icon, title, sub, on }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--card-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <Icon name={icon} size={21} color="var(--horn)" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, marginTop: 2 }}>{sub}</div>
      </div>
      <Toggle on={on} />
    </div>
  );
}

function ScreenPrefs() {
  const zones = ['Alberdi', 'San Vicente', 'General Paz', 'Nueva Córdoba', 'Yofre', 'Centro'];
  const activeZones = [0, 1, 3];
  return (
    <div className="eh" style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar active="Preferencias" />
      <div style={{ flex: 1, overflow: 'hidden', padding: '28px 40px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900 }}>Preferencias de notificación</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 15, marginTop: 5, fontWeight: 600 }}>Elegí qué necesidades y zonas te avisamos. Recibí alertas solo de lo que te importa.</p>
        </div>

        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          {/* left column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
            <div className="card" style={{ padding: '20px 24px 8px' }}>
              <h3 style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>Categorías de alimento</h3>
              <PrefRow icon="spoon" title="Almuerzo" sub="Comedores que sirven el mediodía" on={true} />
              <PrefRow icon="bread" title="Desayuno" sub="Copa de leche y desayunos" on={true} />
              <PrefRow icon="heart" title="Merienda" sub="Meriendas y copa de leche de la tarde" on={false} />
              <PrefRow icon="box" title="Mercadería" sub="Donaciones de alimentos no perecederos" on={true} />
            </div>

            <div className="card" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontSize: 17, fontWeight: 900, marginBottom: 6 }}>Canales</h3>
              <PrefRow icon="mail" title="Email" sub="mb.rios@correo.ar" on={true} />
              <PrefRow icon="bell" title="Notificaciones push" sub="En tu teléfono y navegador" on={true} />
            </div>
          </div>

          {/* right column */}
          <div style={{ width: 380, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* zone selector */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>Zonas de interés</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Tocá los barrios donde querés ayudar.</p>
              <div style={{ borderRadius: 14, overflow: 'hidden', height: 190, position: 'relative', marginBottom: 14 }}>
                <MapPlaceholder pins={[{ x: '30%', y: '40%', active: true }, { x: '60%', y: '55%', active: true }, { x: '70%', y: '30%', active: true }]} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {zones.map((z, i) => (
                  <span key={z} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999,
                    fontWeight: 800, fontSize: 13, cursor: 'pointer',
                    background: activeZones.includes(i) ? 'var(--sky-bg)' : 'var(--card-2)',
                    color: activeZones.includes(i) ? '#1C6E96' : 'var(--ink-2)' }}>
                    {activeZones.includes(i) && <Icon name="check" size={13} color="#1C6E96" sw={3} />} {z}
                  </span>
                ))}
              </div>
            </div>

            {/* notification preview */}
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Vista previa de la alerta</div>
              <div className="toast">
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F6E0CF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <Icon name="bell" size={20} color="var(--horn)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--earth)' }}>Nueva necesidad cerca tuyo</span>
                    <Pill variant="urgent" style={{ fontSize: 10.5, padding: '4px 8px' }}>Urgente</Pill>
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.45 }}>
                    <b style={{ color: 'var(--ink)' }}>Comedor Los Hornitos</b> (Alberdi) necesita <b style={{ color: 'var(--ink)' }}>leche en polvo</b> para la merienda.
                  </p>
                  <span className="lnk" style={{ fontSize: 13, marginTop: 6, display: 'inline-block' }}>Ver necesidad →</span>
                </div>
              </div>
            </div>

            <button className="btn btn--primary btn--block" style={{ fontSize: 16 }}>Guardar preferencias</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenPrefs = ScreenPrefs;
