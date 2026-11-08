package assign

import "testing"

// greedySecuencial resolves a round the naive way: donations are processed in input order and
// each one takes its best still-free candidate. It is the "independent argmax" baseline once the
// one-necesidad-per-donation constraint forces collisions to be resolved somehow.
func greedySecuencial(donaciones []Donacion, candidatos []Candidato) float64 {
	usado := make(map[int64]bool)
	var total float64
	for _, d := range donaciones {
		var mejor float64
		var mejorID int64 = -1
		for _, c := range candidatos {
			if usado[c.NecesidadID] {
				continue
			}
			if s, ok := Score(d, c, PesosPorDefecto, ParametrosPorDefecto); ok && s > mejor {
				mejor, mejorID = s, c.NecesidadID
			}
		}
		if mejorID >= 0 {
			usado[mejorID] = true
			total += mejor
		}
	}
	return total
}

// argmaxDe returns the necesidad a donation would pick if it were alone in the round.
func argmaxDe(d Donacion, candidatos []Candidato) int64 {
	var mejorID int64 = -1
	mejor := -1.0
	for _, c := range candidatos {
		if s, ok := Score(d, c, PesosPorDefecto, ParametrosPorDefecto); ok && s > mejor {
			mejor, mejorID = s, c.NecesidadID
		}
	}
	return mejorID
}

// TestRondaGlobalSuperaAlGreedyBajoContencion proves, under the current default weights, that the
// round optimum has a strictly higher total score than a per-donation greedy pick. Both
// donations independently prefer necesidad 10 (real contention); donation 1 prefers it only
// marginally while donation 2 prefers it by a wide margin, so a greedy pass in input order
// wastes necesidad 10 on donation 1. This replaces the stale fixture in
// TestRondaSuperaAlArgmaxIndependiente, which is left untouched.
func TestRondaGlobalSuperaAlGreedyBajoContencion(t *testing.T) {
	donaciones := []Donacion{
		{ID: 1, Latitud: latCentro + 0.045, Longitud: lngCentro},
		{ID: 2, Latitud: latCentro, Longitud: lngCentro},
	}
	candidatos := []Candidato{
		{NecesidadID: 10, OrganizacionID: 100, Latitud: latCentro, Longitud: lngCentro, Deficit: 3, Urgencia: 1},
		{NecesidadID: 11, OrganizacionID: 101, Latitud: latCentro + 0.09, Longitud: lngCentro, Deficit: 2.4, Urgencia: 0.8},
	}

	if argmaxDe(donaciones[0], candidatos) != 10 || argmaxDe(donaciones[1], candidatos) != 10 {
		t.Fatal("fixture broken: both donations must independently prefer necesidad 10")
	}

	res := Ronda(donaciones, candidatos, PesosPorDefecto, ParametrosPorDefecto)
	greedy := greedySecuencial(donaciones, candidatos)
	t.Logf("round=%v greedy=%v", res.ScoreTotal, greedy)

	if len(res.Asignaciones) != 2 {
		t.Fatalf("asignaciones = %d, want 2", len(res.Asignaciones))
	}
	if res.ScoreTotal <= greedy+1e-9 {
		t.Fatalf("round total %v does not beat greedy total %v", res.ScoreTotal, greedy)
	}
	for _, a := range res.Asignaciones {
		if a.DonacionID == 2 && a.NecesidadID != 10 {
			t.Errorf("donation 2 went to %d; the round optimum gives it necesidad 10", a.NecesidadID)
		}
	}
}
