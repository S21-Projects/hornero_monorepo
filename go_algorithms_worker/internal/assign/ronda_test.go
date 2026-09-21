package assign

import "testing"

func candidato(necesidadID, organizacionID int64, lat, lng float64) Candidato {
	return Candidato{
		NecesidadID:    necesidadID,
		OrganizacionID: organizacionID,
		Latitud:        lat,
		Longitud:       lng,
		Deficit:        1,
		Urgencia:       0.5,
	}
}

// Córdoba-ish coordinates, a few kilometres apart.
const (
	latCentro = -31.4201
	lngCentro = -64.1888
)

func TestRondaNoRepiteNecesidad(t *testing.T) {
	donaciones := []Donacion{
		{ID: 1, Latitud: latCentro, Longitud: lngCentro},
		{ID: 2, Latitud: latCentro, Longitud: lngCentro},
	}
	candidatos := []Candidato{
		candidato(10, 100, latCentro, lngCentro),
		candidato(11, 101, latCentro+0.05, lngCentro),
	}

	res := Ronda(donaciones, candidatos, PesosPorDefecto, ParametrosPorDefecto)

	if len(res.Asignaciones) != 2 {
		t.Fatalf("asignaciones = %d, want 2", len(res.Asignaciones))
	}
	if res.Asignaciones[0].NecesidadID == res.Asignaciones[1].NecesidadID {
		t.Fatal("the same necesidad was filled twice in one round")
	}
}

// One organizacion with two open necesidades may legitimately take two
// donations. The constraint is per necesidad, not per organizacion.
func TestRondaPermiteDosNecesidadesDeLaMismaOrganizacion(t *testing.T) {
	donaciones := []Donacion{
		{ID: 1, Latitud: latCentro, Longitud: lngCentro},
		{ID: 2, Latitud: latCentro, Longitud: lngCentro},
	}
	const mismaOrg = 100
	candidatos := []Candidato{
		candidato(10, mismaOrg, latCentro, lngCentro),
		candidato(11, mismaOrg, latCentro, lngCentro),
	}

	res := Ronda(donaciones, candidatos, PesosPorDefecto, ParametrosPorDefecto)

	if len(res.Asignaciones) != 2 {
		t.Fatalf("asignaciones = %d, want 2", len(res.Asignaciones))
	}
	for _, a := range res.Asignaciones {
		if a.OrganizacionID != mismaOrg {
			t.Errorf("organizacionId = %d, want %d", a.OrganizacionID, mismaOrg)
		}
	}
}

// The whole reason this is an assignment problem: a per-donation argmax would
// send both donations to the single best comedor and leave the round worse off.
func TestRondaSuperaAlArgmaxIndependiente(t *testing.T) {
	donaciones := []Donacion{
		{ID: 1, Latitud: latCentro, Longitud: lngCentro},
		{ID: 2, Latitud: latCentro + 0.2, Longitud: lngCentro},
	}
	candidatos := []Candidato{
		{NecesidadID: 10, OrganizacionID: 100, Latitud: latCentro, Longitud: lngCentro, Deficit: 3, Urgencia: 1},
		{NecesidadID: 11, OrganizacionID: 101, Latitud: latCentro + 0.2, Longitud: lngCentro, Deficit: 2.5, Urgencia: 0.9},
	}

	res := Ronda(donaciones, candidatos, PesosPorDefecto, ParametrosPorDefecto)

	// Greedy: both donations independently prefer candidate 10.
	mejorPara := func(d Donacion) int64 {
		var mejorID int64
		mejor := -1.0
		for _, c := range candidatos {
			if s, ok := Score(d, c, PesosPorDefecto, ParametrosPorDefecto); ok && s > mejor {
				mejor, mejorID = s, c.NecesidadID
			}
		}
		return mejorID
	}
	if mejorPara(donaciones[0]) != mejorPara(donaciones[1]) {
		t.Skip("fixture no longer creates contention")
	}

	if len(res.Asignaciones) != 2 {
		t.Fatalf("asignaciones = %d, want 2", len(res.Asignaciones))
	}
	var costoOportunidadTotal float64
	for _, a := range res.Asignaciones {
		if a.DonacionID == 2 && a.NecesidadID != 11 {
			t.Errorf("donation 2 went to %d; the round optimum pairs it with 11", a.NecesidadID)
		}
		if a.CostoOportunidad < 0 {
			t.Errorf("costoOportunidad = %v, must never be negative", a.CostoOportunidad)
		}
		costoOportunidadTotal += a.CostoOportunidad
	}

	// Contention means at least one donation did not get its own best pick,
	// which is exactly what the opportunity cost records for the audit trail.
	if costoOportunidadTotal <= 0 {
		t.Error("costoOportunidad total = 0, want > 0 under contention")
	}
}

// Anti-starvation: a comedor that keeps losing eventually wins on wait alone.
func TestEsperaRescataAlCandidatoPostergado(t *testing.T) {
	d := Donacion{ID: 1, Latitud: latCentro, Longitud: lngCentro}

	favorito := Candidato{NecesidadID: 10, OrganizacionID: 100, Latitud: latCentro, Longitud: lngCentro, Deficit: 1.2, Urgencia: 0.6}
	postergado := favorito
	postergado.NecesidadID = 11
	postergado.OrganizacionID = 101
	postergado.Latitud = latCentro + 0.02

	antes, _ := Score(d, postergado, PesosPorDefecto, ParametrosPorDefecto)
	base, _ := Score(d, favorito, PesosPorDefecto, ParametrosPorDefecto)
	if antes >= base {
		t.Fatal("fixture broken: the postponed candidate already wins")
	}

	postergado.DiasDesdeUltimaDonacion = 90
	despues, _ := Score(d, postergado, PesosPorDefecto, ParametrosPorDefecto)
	if despues <= base {
		t.Fatalf("after 90 days the postponed candidate still loses: %v vs %v", despues, base)
	}
}

func TestRondaRespetaCategoriaYDistancia(t *testing.T) {
	d := Donacion{ID: 1, Latitud: latCentro, Longitud: lngCentro, Categoria: "ALIMENTO_SECO"}

	lejos := candidato(10, 100, latCentro+5, lngCentro)
	otraCategoria := candidato(11, 101, latCentro, lngCentro)
	otraCategoria.CategoriasAceptadas = []string{"ROPA"}

	res := Ronda([]Donacion{d}, []Candidato{lejos, otraCategoria}, PesosPorDefecto, ParametrosPorDefecto)

	if len(res.Asignaciones) != 0 {
		t.Fatalf("asignaciones = %d, want 0 (both candidates are infeasible)", len(res.Asignaciones))
	}
	if len(res.SinAsignar) != 1 || res.SinAsignar[0] != 1 {
		t.Fatalf("sinAsignar = %v, want [1]", res.SinAsignar)
	}
}

func TestRondaConMasDonacionesQueCandidatos(t *testing.T) {
	donaciones := []Donacion{
		{ID: 1, Latitud: latCentro, Longitud: lngCentro},
		{ID: 2, Latitud: latCentro, Longitud: lngCentro},
		{ID: 3, Latitud: latCentro, Longitud: lngCentro},
	}
	candidatos := []Candidato{candidato(10, 100, latCentro, lngCentro)}

	res := Ronda(donaciones, candidatos, PesosPorDefecto, ParametrosPorDefecto)

	if len(res.Asignaciones) != 1 {
		t.Fatalf("asignaciones = %d, want 1", len(res.Asignaciones))
	}
	if len(res.SinAsignar) != 2 {
		t.Fatalf("sinAsignar = %v, want 2 entries", res.SinAsignar)
	}
}
