package assign

import (
	"math"
	"testing"
)

// TestPriorCumplimientoPromedioDeLaRonda: p0 (AD-11) is the ronda-wide average compliance rate
// across every candidate that has history, ignoring candidates with none.
func TestPriorCumplimientoPromedioDeLaRonda(t *testing.T) {
	conteos := []*ConteoCumplimiento{
		{Entregadas: 8, Fallidas: 1}, // 8/9
		{Entregadas: 1, Fallidas: 1}, // 1/2
		nil,                          // no history: excluded from the average itself
	}

	got := PriorCumplimiento(conteos, nil)

	// (8+1) / (9+2) = 9/11
	want := 9.0 / 11.0
	if math.Abs(got-want) > 1e-9 {
		t.Fatalf("PriorCumplimiento() = %v, want %v", got, want)
	}
}

// TestPriorCumplimientoSinHistorialEnLaRonda: when nobody in the ronda has resolved donaciones,
// p0 falls back to 0.5 — neither favoured nor penalised.
func TestPriorCumplimientoSinHistorialEnLaRonda(t *testing.T) {
	conteos := []*ConteoCumplimiento{nil, {Entregadas: 0, Fallidas: 0}}

	got := PriorCumplimiento(conteos, nil)

	if got != 0.5 {
		t.Fatalf("PriorCumplimiento() = %v, want 0.5", got)
	}
}

// TestPriorCumplimientoOverride: an explicit parametros.cumplimientoPrior always wins, with no
// computation over the ronda's own history at all.
func TestPriorCumplimientoOverride(t *testing.T) {
	conteos := []*ConteoCumplimiento{{Entregadas: 8, Fallidas: 1}}
	override := 0.42

	got := PriorCumplimiento(conteos, &override)

	if got != 0.42 {
		t.Fatalf("PriorCumplimiento() = %v, want override 0.42", got)
	}
}

// TestTasaCumplimientoFormulaDelSpec: the worked example from design.md AD-11 and
// specs/asignacion-historial-cumplimiento/spec.md — 8 entregadas / 1 fallida, smoothed with
// m = 5 pseudo-observations toward p0.
func TestTasaCumplimientoFormulaDelSpec(t *testing.T) {
	conteo := &ConteoCumplimiento{Entregadas: 8, Fallidas: 1}
	p0 := 0.5
	m := 5.0

	got := TasaCumplimiento(conteo, p0, m)

	// (8 + 5*0.5) / (8 + 1 + 5) = 10.5 / 14
	want := 10.5 / 14.0
	if math.Abs(got-want) > 1e-9 {
		t.Fatalf("TasaCumplimiento() = %v, want %v", got, want)
	}
}

// TestTasaCumplimientoSinHistorialDaExactamenteElPrior: a candidate with zero counts (nil, or
// absent in the wire payload before 6b existed) reduces to exactly p0 — the formula needs no
// special case for "no history" because entregadas = fallidas = 0 already does the right thing.
func TestTasaCumplimientoSinHistorialDaExactamenteElPrior(t *testing.T) {
	p0 := 0.63
	m := 5.0

	gotNil := TasaCumplimiento(nil, p0, m)
	gotCero := TasaCumplimiento(&ConteoCumplimiento{}, p0, m)

	if gotNil != p0 {
		t.Fatalf("TasaCumplimiento(nil, ...) = %v, want p0 %v", gotNil, p0)
	}
	if gotCero != p0 {
		t.Fatalf("TasaCumplimiento(&ConteoCumplimiento{}, ...) = %v, want p0 %v", gotCero, p0)
	}
}
