package contrato

import (
	"encoding/json"
	"errors"
	"math"
	"testing"

	"algorithms/internal/assign"
	"algorithms/internal/geo"
)

// resolvedorVacio mirrors internal/api/handler_test.go's helper of the same name: no RENACOM data
// loaded, so every candidate resolves to NEUTRAL — irrelevant to the cumplimiento tests below.
func resolvedorVacio() *geo.Resolvedor {
	return geo.NuevoResolvedor(nil, nil, 1.0)
}

func entradaValida() EntradaRondaV1 {
	return EntradaRondaV1{
		Version: 1,
		Donaciones: []DonacionV1{
			{ID: 1, Latitud: -31.41, Longitud: -64.18, Categoria: "NO_PERECEDERO"},
		},
		Candidatos: []CandidatoV1{
			{NecesidadID: 10, OrganizacionID: 100, Latitud: -31.40, Longitud: -64.20, Urgencia: 0.5},
		},
	}
}

func codigoDe(t *testing.T, err error) string {
	t.Helper()
	var ec *ErrorContrato
	if !errors.As(err, &ec) {
		t.Fatalf("err = %v (%T), want *ErrorContrato", err, err)
	}
	return ec.Codigo
}

func TestValidarEntradaValidaNoFalla(t *testing.T) {
	if err := entradaValida().Validar(); err != nil {
		t.Fatalf("valid input rejected: %v", err)
	}
}

func TestValidarVersionNoSoportada(t *testing.T) {
	e := entradaValida()
	e.Version = 2
	if got := codigoDe(t, e.Validar()); got != "VERSION_NO_SOPORTADA" {
		t.Fatalf("codigo = %q, want VERSION_NO_SOPORTADA", got)
	}
}

func TestValidarVersionCero(t *testing.T) {
	e := entradaValida()
	e.Version = 0
	if got := codigoDe(t, e.Validar()); got != "VERSION_NO_SOPORTADA" {
		t.Fatalf("codigo = %q, want VERSION_NO_SOPORTADA", got)
	}
}

func TestValidarLimiteDonaciones(t *testing.T) {
	e := entradaValida()
	for i := 0; i < 500; i++ {
		e.Donaciones = append(e.Donaciones, DonacionV1{ID: int64(i + 100), Latitud: -31.4, Longitud: -64.2})
	}
	if got := codigoDe(t, e.Validar()); got != "ENTRADA_INVALIDA" {
		t.Fatalf("codigo = %q, want ENTRADA_INVALIDA for 501 donaciones", got)
	}
}

func TestValidarLimiteCandidatos(t *testing.T) {
	e := entradaValida()
	for i := 0; i < 500; i++ {
		e.Candidatos = append(e.Candidatos, CandidatoV1{NecesidadID: int64(i + 1000), OrganizacionID: int64(i + 2000), Latitud: -31.4, Longitud: -64.2})
	}
	if got := codigoDe(t, e.Validar()); got != "ENTRADA_INVALIDA" {
		t.Fatalf("codigo = %q, want ENTRADA_INVALIDA for 501 candidatos", got)
	}
}

func TestValidarLimiteExacto500NoFalla(t *testing.T) {
	e := entradaValida()
	for i := 0; i < 499; i++ {
		e.Donaciones = append(e.Donaciones, DonacionV1{ID: int64(i + 100), Latitud: -31.4, Longitud: -64.2})
		e.Candidatos = append(e.Candidatos, CandidatoV1{NecesidadID: int64(i + 1000), OrganizacionID: int64(i + 2000), Latitud: -31.4, Longitud: -64.2})
	}
	if err := e.Validar(); err != nil {
		t.Fatalf("500 donaciones/candidatos exactly must be accepted, got: %v", err)
	}
}

func TestValidarCoordenadasFinitasYEnRango(t *testing.T) {
	tests := []struct {
		name string
		mut  func(*EntradaRondaV1)
	}{
		{"donacion latitud fuera de rango", func(e *EntradaRondaV1) { e.Donaciones[0].Latitud = 200 }},
		{"donacion longitud fuera de rango", func(e *EntradaRondaV1) { e.Donaciones[0].Longitud = -200 }},
		{"donacion latitud NaN", func(e *EntradaRondaV1) { e.Donaciones[0].Latitud = math.NaN() }},
		{"candidato longitud infinita", func(e *EntradaRondaV1) { e.Candidatos[0].Longitud = math.Inf(1) }},
		{"candidato latitud infinita negativa", func(e *EntradaRondaV1) { e.Candidatos[0].Latitud = math.Inf(-1) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := entradaValida()
			tt.mut(&e)
			if got := codigoDe(t, e.Validar()); got != "ENTRADA_INVALIDA" {
				t.Fatalf("codigo = %q, want ENTRADA_INVALIDA", got)
			}
		})
	}
}

// TestValidarCategoriaDesconocidaPasaSinCambios: AD-14 — categoria is a free-text pass-through,
// not a closed enum the worker validates. A future category the worker has never heard of must
// not be rejected.
func TestValidarCategoriaDesconocidaPasaSinCambios(t *testing.T) {
	e := entradaValida()
	e.Donaciones[0].Categoria = "UNA_CATEGORIA_QUE_NO_EXISTE_TODAVIA"
	if err := e.Validar(); err != nil {
		t.Fatalf("unknown categoria must pass through untouched, got err: %v", err)
	}
}

// TestADonacionesMapeaCampos: 5a.7 — wire DTOs map onto the unchanged assign.Donacion, including
// the AD-10/AD-3 fields a producer may not have set yet.
func TestADonacionesMapeaCampos(t *testing.T) {
	e := entradaValida()
	e.Donaciones[0].DiasEnFondo = 12
	e.Donaciones[0].OrganizacionesExcluidas = []int64{5}

	out := e.ADonaciones()
	if len(out) != 1 {
		t.Fatalf("len = %d, want 1", len(out))
	}
	got := out[0]
	if got.ID != 1 || got.DiasEnFondo != 12 || len(got.OrganizacionesExcluidas) != 1 || got.OrganizacionesExcluidas[0] != 5 {
		t.Fatalf("mapped donacion = %+v", got)
	}
}

// TestADonacionesMapeaArticuloIds: feature catalogo-articulos, work unit C — the additive
// articuloIds field round-trips through ADonaciones exactly like OrganizacionesExcluidas does.
func TestADonacionesMapeaArticuloIds(t *testing.T) {
	e := entradaValida()
	e.Donaciones[0].ArticuloIds = []int64{7, 8}

	out := e.ADonaciones()
	if len(out) != 1 || len(out[0].ArticuloIds) != 2 || out[0].ArticuloIds[0] != 7 || out[0].ArticuloIds[1] != 8 {
		t.Fatalf("mapped donacion articuloIds = %+v, want [7 8]", out[0].ArticuloIds)
	}
}

// TestADonacionesArticuloIdsAusenteMapeaNil: an absent articuloIds (mid-rollout producer) must
// not fabricate an empty-but-non-nil slice that would behave differently from "not provided".
func TestADonacionesArticuloIdsAusenteMapeaNil(t *testing.T) {
	out := entradaValida().ADonaciones()
	if len(out[0].ArticuloIds) != 0 {
		t.Fatalf("articuloIds = %+v, want empty", out[0].ArticuloIds)
	}
}

// TestACandidatosMapeaArticuloIds: same round-trip, on the candidato side.
func TestACandidatosMapeaArticuloIds(t *testing.T) {
	e := entradaValida()
	e.Candidatos[0].ArticuloIds = []int64{7, 9}

	out, _ := e.ACandidatos(resolvedorVacio(), assign.PseudoObsPorDefecto)
	if len(out) != 1 || len(out[0].ArticuloIds) != 2 || out[0].ArticuloIds[0] != 7 || out[0].ArticuloIds[1] != 9 {
		t.Fatalf("mapped candidato articuloIds = %+v, want [7 9]", out[0].ArticuloIds)
	}
}

// TestDecodificaCumplimientoYParametrosNuevos: 6a.3 — the additive wire fields decode correctly
// and absent ones default to nil/zero, never erroring (AD-14's additive-only contract).
func TestDecodificaCumplimientoYParametrosNuevos(t *testing.T) {
	raw := []byte(`{
		"version": 1,
		"donaciones": [{"id": 1, "latitud": -31.41, "longitud": -64.18, "categoria": "NO_PERECEDERO"}],
		"candidatos": [
			{"necesidadId": 10, "organizacionId": 100, "latitud": -31.40, "longitud": -64.20,
			 "urgencia": 0.5, "cumplimiento": {"entregadas": 8, "fallidas": 1}},
			{"necesidadId": 11, "organizacionId": 101, "latitud": -31.40, "longitud": -64.20, "urgencia": 0.5}
		],
		"pesos": {"deficit": 0.3, "urgencia": 0.25, "proximidad": 0.17, "espera": 0.13, "cumplimiento": 0.15},
		"parametros": {"cumplimientoPrior": 0.42, "cumplimientoPseudoObs": 3}
	}`)

	var e EntradaRondaV1
	if err := json.Unmarshal(raw, &e); err != nil {
		t.Fatalf("decoding: %v", err)
	}
	if e.Candidatos[0].Cumplimiento == nil || e.Candidatos[0].Cumplimiento.Entregadas != 8 || e.Candidatos[0].Cumplimiento.Fallidas != 1 {
		t.Fatalf("candidatos[0].Cumplimiento = %+v, want {8 1}", e.Candidatos[0].Cumplimiento)
	}
	if e.Candidatos[1].Cumplimiento != nil {
		t.Fatalf("candidatos[1].Cumplimiento = %+v, want nil (absent field)", e.Candidatos[1].Cumplimiento)
	}
	if e.Pesos == nil || e.Pesos.Cumplimiento != 0.15 {
		t.Fatalf("pesos.Cumplimiento = %+v, want 0.15", e.Pesos)
	}
	if e.Parametros == nil || e.Parametros.CumplimientoPrior == nil || *e.Parametros.CumplimientoPrior != 0.42 {
		t.Fatalf("parametros.CumplimientoPrior = %+v, want 0.42", e.Parametros)
	}
	if e.Parametros.CumplimientoPseudoObs == nil || *e.Parametros.CumplimientoPseudoObs != 3 {
		t.Fatalf("parametros.CumplimientoPseudoObs = %+v, want 3", e.Parametros.CumplimientoPseudoObs)
	}
}

// TestACandidatosResuelveTasaCumplimientoConPriorDeLaRonda: 6a.6 — ACandidatos computes the
// ronda-wide neutral prior from the raw counts it received and applies AD-11's smoothed-rate
// formula per candidate, including the one that sent no cumplimiento at all.
func TestACandidatosResuelveTasaCumplimientoConPriorDeLaRonda(t *testing.T) {
	e := EntradaRondaV1{
		Version: 1,
		Candidatos: []CandidatoV1{
			{NecesidadID: 10, OrganizacionID: 100, Latitud: -31.40, Longitud: -64.20, Urgencia: 0.5,
				Cumplimiento: &CumplimientoV1{Entregadas: 8, Fallidas: 1}},
			{NecesidadID: 11, OrganizacionID: 101, Latitud: -31.40, Longitud: -64.20, Urgencia: 0.5},
		},
	}

	out, _ := e.ACandidatos(resolvedorVacio(), assign.PseudoObsPorDefecto)

	// p0 = 8/9 (only candidate 10 has history); candidate 10's own smoothed rate pulls toward it;
	// candidate 11 (no history at all) gets exactly p0.
	p0 := 8.0 / 9.0
	wantCand10 := (8.0 + assign.PseudoObsPorDefecto*p0) / (8.0 + 1.0 + assign.PseudoObsPorDefecto)
	if math.Abs(out[0].TasaCumplimiento-wantCand10) > 1e-9 {
		t.Fatalf("out[0].TasaCumplimiento = %v, want %v", out[0].TasaCumplimiento, wantCand10)
	}
	if math.Abs(out[1].TasaCumplimiento-p0) > 1e-9 {
		t.Fatalf("out[1].TasaCumplimiento = %v, want p0 %v (no history, neutral prior)", out[1].TasaCumplimiento, p0)
	}
}

// TestACandidatosRespetaCumplimientoPriorOverride: the request's parametros.cumplimientoPrior
// overrides the computed ronda average entirely.
func TestACandidatosRespetaCumplimientoPriorOverride(t *testing.T) {
	override := 0.1
	e := EntradaRondaV1{
		Version: 1,
		Candidatos: []CandidatoV1{
			{NecesidadID: 10, OrganizacionID: 100, Latitud: -31.40, Longitud: -64.20, Urgencia: 0.5,
				Cumplimiento: &CumplimientoV1{Entregadas: 8, Fallidas: 1}},
		},
		Parametros: &ParametrosV1{CumplimientoPrior: &override},
	}

	out, _ := e.ACandidatos(resolvedorVacio(), assign.PseudoObsPorDefecto)

	want := (8.0 + assign.PseudoObsPorDefecto*override) / (8.0 + 1.0 + assign.PseudoObsPorDefecto)
	if math.Abs(out[0].TasaCumplimiento-want) > 1e-9 {
		t.Fatalf("out[0].TasaCumplimiento = %v, want %v (override must win)", out[0].TasaCumplimiento, want)
	}
}

// TestResolverParametrosCumplimientoPseudoObs: the request's parametros.cumplimientoPseudoObs
// overrides assign.PseudoObsPorDefecto on the resolved assign.Parametros, echoed back to the
// caller like every other parametros override.
func TestResolverParametrosCumplimientoPseudoObs(t *testing.T) {
	porDefecto := entradaValida()
	p, _ := porDefecto.ResolverParametros()
	if p.CumplimientoPseudoObs != assign.PseudoObsPorDefecto {
		t.Fatalf("CumplimientoPseudoObs (default) = %v, want %v", p.CumplimientoPseudoObs, assign.PseudoObsPorDefecto)
	}

	override := 3.0
	conOverride := entradaValida()
	conOverride.Parametros = &ParametrosV1{CumplimientoPseudoObs: &override}
	p, _ = conOverride.ResolverParametros()
	if p.CumplimientoPseudoObs != 3 {
		t.Fatalf("CumplimientoPseudoObs (override) = %v, want 3", p.CumplimientoPseudoObs)
	}
}
