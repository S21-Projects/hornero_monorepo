package assign

import (
	"math"
	"testing"
)

// candidatoConCategorias mirrors the candidato() helper in ronda_test.go, adding the two
// category fields under test here.
func candidatoConCategorias(categoriasAceptadas, categoriasPermitidas []string) Candidato {
	return Candidato{
		NecesidadID:          1,
		OrganizacionID:       100,
		Latitud:              latCentro,
		Longitud:             lngCentro,
		Deficit:              1,
		Urgencia:             0.5,
		CategoriasAceptadas:  categoriasAceptadas,
		CategoriasPermitidas: categoriasPermitidas,
	}
}

// TestAceptaCategoriasPermitidas: AD-10 — the accreditation level is a second hard filter,
// independent of CategoriasAceptadas (what the necesidad asked for).
func TestAceptaCategoriasPermitidas(t *testing.T) {
	donacion := Donacion{ID: 1, Latitud: latCentro, Longitud: lngCentro, Categoria: "REFRIGERADO"}

	tests := []struct {
		name                 string
		categoriasAceptadas  []string
		categoriasPermitidas []string
		wantOk               bool
	}{
		{
			name:                 "empty CategoriasPermitidas is a no-op, matching the empty CategoriasAceptadas rule",
			categoriasAceptadas:  nil,
			categoriasPermitidas: nil,
			wantOk:               true,
		},
		{
			name:                 "category in CategoriasAceptadas but not in CategoriasPermitidas is rejected",
			categoriasAceptadas:  []string{"REFRIGERADO"},
			categoriasPermitidas: []string{"NO_PERECEDERO"},
			wantOk:               false,
		},
		{
			name:                 "category in both sets is accepted",
			categoriasAceptadas:  []string{"REFRIGERADO"},
			categoriasPermitidas: []string{"REFRIGERADO", "CONGELADO"},
			wantOk:               true,
		},
		{
			name:                 "empty CategoriasAceptadas but a restrictive CategoriasPermitidas still filters",
			categoriasAceptadas:  nil,
			categoriasPermitidas: []string{"NO_PERECEDERO"},
			wantOk:               false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := candidatoConCategorias(tt.categoriasAceptadas, tt.categoriasPermitidas)

			_, ok := Score(donacion, c, PesosPorDefecto, ParametrosPorDefecto)

			if ok != tt.wantOk {
				t.Fatalf("Score() ok = %v, want %v", ok, tt.wantOk)
			}
		})
	}
}

// TestEmptyCategoriasPermitidasLeavesExistingRoundResultsUnchanged proves the field is additive:
// a full Ronda computed with CategoriasPermitidas unset (every caller before this producer
// exists) matches the same round computed with it explicitly empty.
func TestEmptyCategoriasPermitidasLeavesExistingRoundResultsUnchanged(t *testing.T) {
	donaciones := []Donacion{
		{ID: 1, Latitud: latCentro, Longitud: lngCentro, Categoria: "REFRIGERADO"},
		{ID: 2, Latitud: latCentro, Longitud: lngCentro, Categoria: ""},
	}

	base := []Candidato{
		candidato(10, 100, latCentro, lngCentro),
		candidato(11, 101, latCentro+0.05, lngCentro),
	}
	withEmptyPermitidas := []Candidato{
		{
			NecesidadID: base[0].NecesidadID, OrganizacionID: base[0].OrganizacionID,
			Latitud: base[0].Latitud, Longitud: base[0].Longitud,
			Deficit: base[0].Deficit, Urgencia: base[0].Urgencia,
			CategoriasPermitidas: []string{},
		},
		{
			NecesidadID: base[1].NecesidadID, OrganizacionID: base[1].OrganizacionID,
			Latitud: base[1].Latitud, Longitud: base[1].Longitud,
			Deficit: base[1].Deficit, Urgencia: base[1].Urgencia,
			CategoriasPermitidas: []string{},
		},
	}

	resBase := Ronda(donaciones, base, PesosPorDefecto, ParametrosPorDefecto)
	resEmptyPermitidas := Ronda(donaciones, withEmptyPermitidas, PesosPorDefecto, ParametrosPorDefecto)

	if len(resBase.Asignaciones) != len(resEmptyPermitidas.Asignaciones) {
		t.Fatalf("asignaciones = %d, want %d (empty CategoriasPermitidas must be a no-op)",
			len(resEmptyPermitidas.Asignaciones), len(resBase.Asignaciones))
	}
	for i := range resBase.Asignaciones {
		if resBase.Asignaciones[i] != resEmptyPermitidas.Asignaciones[i] {
			t.Fatalf("asignacion[%d] = %+v, want %+v (empty CategoriasPermitidas changed the outcome)",
				i, resEmptyPermitidas.Asignaciones[i], resBase.Asignaciones[i])
		}
	}
}

// TestScoreConDesgloseDelegaMismoValorQueScore: 5a.4 — ScoreDetallado (here Desglose) exposes the
// per-criterion terms that Score already computed internally; Score must keep returning the exact
// same total once it becomes a thin delegation.
func TestScoreConDesgloseDelegaMismoValorQueScore(t *testing.T) {
	d := Donacion{ID: 1, Latitud: latCentro, Longitud: lngCentro, Categoria: "NO_PERECEDERO"}
	c := candidato(10, 100, latCentro+0.01, lngCentro)
	c.Deficit = 2
	c.Urgencia = 0.7
	c.DiasDesdeUltimaDonacion = 30

	score, ok := Score(d, c, PesosPorDefecto, ParametrosPorDefecto)
	desglose, scoreDetallado, okDetallado := ScoreConDesglose(d, c, PesosPorDefecto, ParametrosPorDefecto)

	if !ok || !okDetallado {
		t.Fatalf("ok = %v/%v, want true/true", ok, okDetallado)
	}
	if math.Abs(score-scoreDetallado) > 1e-9 {
		t.Fatalf("Score() = %v, ScoreConDesglose() = %v, must match", score, scoreDetallado)
	}
	want := PesosPorDefecto.Deficit*desglose.Deficit +
		PesosPorDefecto.Urgencia*desglose.Urgencia +
		PesosPorDefecto.Proximidad*desglose.Proximidad +
		PesosPorDefecto.Espera*desglose.Espera
	if math.Abs(want-scoreDetallado) > 1e-9 {
		t.Fatalf("weighted desglose sum = %v, want score %v", want, scoreDetallado)
	}
}

// TestNormalizadosDivideProporcionalmente: AD-11 — adding the compliance weight on top must not
// unbalance the existing four; Normalizados() divides every term by the sum so any configuration
// reads as a 0-1 contribution.
func TestNormalizadosDivideProporcionalmente(t *testing.T) {
	w := Pesos{Deficit: 2, Urgencia: 2, Proximidad: 2, Espera: 2, Cumplimiento: 2}

	got := w.Normalizados()

	want := Pesos{Deficit: 0.2, Urgencia: 0.2, Proximidad: 0.2, Espera: 0.2, Cumplimiento: 0.2}
	if got != want {
		t.Fatalf("Normalizados() = %+v, want %+v", got, want)
	}
}

// TestNormalizadosCumplimientoCeroReproduceFormulaDeCuatroTerminos: the spec's own scenario —
// with Cumplimiento weighted at 0, Normalizados() must reduce the other four back to exactly the
// pre-6a PesosPorDefecto ratios (0.35/0.30/0.20/0.15, which already sum to 1).
func TestNormalizadosCumplimientoCeroReproduceFormulaDeCuatroTerminos(t *testing.T) {
	w := Pesos{Deficit: 0.35, Urgencia: 0.30, Proximidad: 0.20, Espera: 0.15, Cumplimiento: 0}

	got := w.Normalizados()

	if math.Abs(got.Deficit-w.Deficit) > 1e-9 || math.Abs(got.Urgencia-w.Urgencia) > 1e-9 ||
		math.Abs(got.Proximidad-w.Proximidad) > 1e-9 || math.Abs(got.Espera-w.Espera) > 1e-9 ||
		got.Cumplimiento != 0 {
		t.Fatalf("Normalizados() = %+v, want unchanged %+v (already summed to 1)", got, w)
	}
}

// TestScoreConDesglosePonderaCumplimiento proves the fifth term is actually wired into the
// weighted sum, not just carried in the Desglose for display.
func TestScoreConDesglosePonderaCumplimiento(t *testing.T) {
	d := Donacion{ID: 1, Latitud: latCentro, Longitud: lngCentro}
	c := candidato(10, 100, latCentro, lngCentro)
	c.TasaCumplimiento = 0.8

	desglose, score, ok := ScoreConDesglose(d, c, PesosPorDefecto, ParametrosPorDefecto)
	if !ok {
		t.Fatal("expected a feasible pair")
	}
	if desglose.Cumplimiento != 0.8 {
		t.Fatalf("desglose.Cumplimiento = %v, want 0.8 (passthrough of TasaCumplimiento)", desglose.Cumplimiento)
	}

	w := PesosPorDefecto.Normalizados()
	want := w.Deficit*desglose.Deficit + w.Urgencia*desglose.Urgencia +
		w.Proximidad*desglose.Proximidad + w.Espera*desglose.Espera +
		w.Cumplimiento*desglose.Cumplimiento
	if math.Abs(want-score) > 1e-9 {
		t.Fatalf("score = %v, want %v (weighted sum including cumplimiento)", score, want)
	}
}

func TestScoreConDesgloseParInfeasibleDevuelveFalse(t *testing.T) {
	d := Donacion{ID: 1, Latitud: latCentro, Longitud: lngCentro, Categoria: "ROPA"}
	c := candidatoConCategorias([]string{"NO_PERECEDERO"}, nil)

	desglose, score, ok := ScoreConDesglose(d, c, PesosPorDefecto, ParametrosPorDefecto)
	if ok {
		t.Fatal("expected infeasible pair to report ok = false")
	}
	if desglose != (Desglose{}) || score != 0 {
		t.Fatalf("infeasible pair must return the zero value, got desglose=%+v score=%v", desglose, score)
	}
}
