/* app.jsx — assembles the El Hornero canvas + Tweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "typeface": "Nunito",
  "radius": 18
}/*EDITMODE-END*/;

const FONTS = {
  Nunito: '"Nunito", system-ui, sans-serif',
  "DM Sans": '"DM Sans", system-ui, sans-serif',
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--app-font', FONTS[t.typeface] || FONTS.Nunito);
    r.style.setProperty('--r-card', t.radius + 'px');
  }, [t.typeface, t.radius]);

  const SCR = window;

  return (
    <>
      <DesignCanvas>
        <DCSection id="screens" title="Pantallas principales" subtitle="El Hornero · 6 vistas en escritorio — Córdoba, Argentina">
          <DCArtboard id="home"   label="1 · Inicio / Mapa"        width={1440} height={940}>{<SCR.ScreenHome />}</DCArtboard>
          <DCArtboard id="detail" label="2 · Detalle de organización" width={1440} height={1300}>{<SCR.ScreenDetail />}</DCArtboard>
          <DCArtboard id="admin"  label="3 · Panel · Validación"   width={1440} height={920}>{<SCR.ScreenAdmin />}</DCArtboard>
          <DCArtboard id="needs"  label="4 · Tablero de necesidades" width={1440} height={880}>{<SCR.ScreenNeeds />}</DCArtboard>
          <DCArtboard id="users"  label="5 · Gestión de usuarios"  width={1440} height={840}>{<SCR.ScreenUsers />}</DCArtboard>
          <DCArtboard id="prefs"  label="6 · Preferencias de aviso" width={1440} height={840}>{<SCR.ScreenPrefs />}</DCArtboard>
        </DCSection>

        <DCSection id="empty" title="Estados vacíos · Hornero" subtitle="Ilustración del hornero + copy cálido (placeholder etiquetado)">
          <DCArtboard id="ea" label="A · Sin comedores" width={380} height={460}>{<SCR.VarEmptyA />}</DCArtboard>
          <DCArtboard id="eb" label="B · Sin donaciones" width={380} height={460}>{<SCR.VarEmptyB />}</DCArtboard>
          <DCArtboard id="ec" label="C · Sin alertas (nido)" width={380} height={460}>{<SCR.VarEmptyC />}</DCArtboard>
        </DCSection>

        <DCSection id="badges" title="Sistema de badges" subtitle="Pastillas para estado, categoría, prioridad y rol — tres tratamientos">
          <DCArtboard id="ba" label="A · Suave" width={360} height={580}>{<SCR.VarBadgeSoft />}</DCArtboard>
          <DCArtboard id="bb" label="B · Contorno" width={360} height={580}>{<SCR.VarBadgeOutline />}</DCArtboard>
          <DCArtboard id="bc" label="C · Sólido" width={360} height={580}>{<SCR.VarBadgeSolid />}</DCArtboard>
        </DCSection>

        <DCSection id="map" title="Marcadores + ficha del mapa" subtitle="Estilo de pin y de la ficha de resultados en Inicio">
          <DCArtboard id="ma" label="A · Pin + tira inferior" width={440} height={460}>{<SCR.VarMapA />}</DCArtboard>
          <DCArtboard id="mb" label="B · Punto + lista lateral" width={440} height={460}>{<SCR.VarMapB />}</DCArtboard>
          <DCArtboard id="mc" label="C · Cuchara + ficha destacada" width={440} height={460}>{<SCR.VarMapC />}</DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Tipografía" />
        <TweakRadio label="Familia" value={t.typeface} options={["Nunito", "DM Sans"]}
          onChange={(v) => setTweak('typeface', v)} />
        <TweakSection label="Forma" />
        <TweakSlider label="Esquinas" value={t.radius} min={8} max={24} step={1} unit="px"
          onChange={(v) => setTweak('radius', v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
