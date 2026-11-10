package assign

import (
	"math"
	"math/rand"
	"sort"
	"testing"
)

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

// rondaOriginal replicates Ronda's pre-AD-10 behaviour exactly: a single shared pool of
// zero-cost dummy columns, only added when there are fewer candidatos than donaciones. It is the
// oracle TestPenalizacionCeroReproduceRondaOriginal checks the AD-10 per-donation penalty columns
// against, the same way hungarian_test.go's bruteForce checks Hungarian.
func rondaOriginal(donaciones []Donacion, candidatos []Candidato, w Pesos, p Parametros) Resultado {
	if len(donaciones) == 0 || len(candidatos) == 0 {
		res := Resultado{}
		for _, d := range donaciones {
			res.SinAsignar = append(res.SinAsignar, d.ID)
		}
		return res
	}

	costo := MatrizCosto(donaciones, candidatos, w, p)

	realCols := len(candidatos)
	if realCols < len(donaciones) {
		for i := range costo {
			padded := make([]float64, len(donaciones))
			copy(padded, costo[i])
			costo[i] = padded
		}
	}

	rowToCol, _ := Hungarian(costo)

	res := Resultado{}
	for i, j := range rowToCol {
		d := donaciones[i]
		if j == Unassigned || j >= realCols || costo[i][j] >= 0 {
			res.SinAsignar = append(res.SinAsignar, d.ID)
			continue
		}
		c := candidatos[j]
		score := -costo[i][j]
		res.Asignaciones = append(res.Asignaciones, Asignacion{
			DonacionID:       d.ID,
			NecesidadID:      c.NecesidadID,
			OrganizacionID:   c.OrganizacionID,
			Score:            score,
			DistanciaKm:      distanciaKm(d.Latitud, d.Longitud, c.Latitud, c.Longitud),
			CostoOportunidad: mejorScore(costo[i], realCols) - score,
		})
		res.ScoreTotal += score
	}

	sort.Slice(res.Asignaciones, func(a, b int) bool {
		return res.Asignaciones[a].Score > res.Asignaciones[b].Score
	})
	return res
}

// TestPenalizacionCeroReproduceRondaOriginal is the 5a.3 property test: with
// PenalizacionNoAsignar = 0 and every DiasEnFondo = 0 (no producer sets it yet), the AD-10
// per-donation dummy columns must reproduce the exact assigned set and ScoreTotal of the
// pre-AD-10 solver on randomized instances.
//
// The fixtures here are deliberately kept feasible for every pair (no category mismatch, no
// distance beyond DistanciaMaximaKm). A genuinely infeasible pair combined with
// len(candidatos) >= len(donaciones) is a case where the two solvers legitimately disagree —
// see the "infeasible forced matching" note below — and reproducing THAT is out of AD-10's
// scope: the pre-AD-10 solver had no per-row escape hatch there and was forced onto an Inf-cost
// real column it should never have used; AD-10's always-available dummy fixes that as a
// byproduct, it does not need to reproduce it.
func TestPenalizacionCeroReproduceRondaOriginal(t *testing.T) {
	rng := rand.New(rand.NewSource(99))

	for caso := 0; caso < 200; caso++ {
		n := 1 + rng.Intn(6)
		m := 1 + rng.Intn(6)

		donaciones := make([]Donacion, n)
		for i := range donaciones {
			donaciones[i] = Donacion{
				ID:       int64(i + 1),
				Latitud:  latCentro + rng.Float64()*0.05,
				Longitud: lngCentro + rng.Float64()*0.05,
			}
		}

		candidatos := make([]Candidato, m)
		for j := range candidatos {
			candidatos[j] = Candidato{
				NecesidadID:             int64(j + 1000),
				OrganizacionID:          int64(j + 2000),
				Latitud:                 latCentro + rng.Float64()*0.05,
				Longitud:                lngCentro + rng.Float64()*0.05,
				Deficit:                 rng.Float64() * 3,
				Urgencia:                rng.Float64(),
				DiasDesdeUltimaDonacion: rng.Intn(120),
			}
		}

		p := ParametrosPorDefecto
		p.PenalizacionNoAsignar = 0

		got := Ronda(donaciones, candidatos, PesosPorDefecto, p)
		want := rondaOriginal(donaciones, candidatos, PesosPorDefecto, p)

		if math.Abs(got.ScoreTotal-want.ScoreTotal) > 1e-9 {
			t.Fatalf("case %d: scoreTotal = %v, want %v", caso, got.ScoreTotal, want.ScoreTotal)
		}
		if len(got.Asignaciones) != len(want.Asignaciones) {
			t.Fatalf("case %d: asignaciones = %d, want %d", caso, len(got.Asignaciones), len(want.Asignaciones))
		}
		for i := range want.Asignaciones {
			g, w := got.Asignaciones[i], want.Asignaciones[i]
			if g.DonacionID != w.DonacionID || g.NecesidadID != w.NecesidadID ||
				g.OrganizacionID != w.OrganizacionID || math.Abs(g.Score-w.Score) > 1e-9 ||
				math.Abs(g.CostoOportunidad-w.CostoOportunidad) > 1e-9 {
				t.Fatalf("case %d: asignacion[%d] = %+v, want %+v", caso, i, g, w)
			}
		}
		sort.Slice(got.SinAsignar, func(a, b int) bool { return got.SinAsignar[a] < got.SinAsignar[b] })
		sort.Slice(want.SinAsignar, func(a, b int) bool { return want.SinAsignar[a] < want.SinAsignar[b] })
		if len(got.SinAsignar) != len(want.SinAsignar) {
			t.Fatalf("case %d: sinAsignar = %v, want %v", caso, got.SinAsignar, want.SinAsignar)
		}
		for i := range want.SinAsignar {
			if got.SinAsignar[i] != want.SinAsignar[i] {
				t.Fatalf("case %d: sinAsignar = %v, want %v", caso, got.SinAsignar, want.SinAsignar)
			}
		}
	}
}

// TestPenalizacionFavoreceALaDonacionMasVieja: under contention for one scarce necesidad, the
// donation that has waited longer in the pool must win it — AD-10's deterministic
// anti-starvation.
func TestPenalizacionFavoreceALaDonacionMasVieja(t *testing.T) {
	vieja := Donacion{ID: 1, Latitud: latCentro, Longitud: lngCentro, DiasEnFondo: 80}
	nueva := Donacion{ID: 2, Latitud: latCentro, Longitud: lngCentro, DiasEnFondo: 5}
	unica := candidato(10, 100, latCentro, lngCentro)

	p := ParametrosPorDefecto
	p.PenalizacionNoAsignar = 0.5

	res := Ronda([]Donacion{vieja, nueva}, []Candidato{unica}, PesosPorDefecto, p)

	if len(res.Asignaciones) != 1 {
		t.Fatalf("asignaciones = %d, want 1", len(res.Asignaciones))
	}
	if res.Asignaciones[0].DonacionID != vieja.ID {
		t.Fatalf("donacionId asignada = %d, want %d (the older donation should win the scarce necesidad)",
			res.Asignaciones[0].DonacionID, vieja.ID)
	}
	if len(res.SinAsignar) != 1 || res.SinAsignar[0] != nueva.ID {
		t.Fatalf("sinAsignar = %v, want [%d]", res.SinAsignar, nueva.ID)
	}
}

// TestOrganizacionesExcluidasEsFiltroDuro: a devolución al fondo excludes that organizacion for
// that donation (AD-3) — the solver must never re-propose it, regardless of how well it scores.
func TestOrganizacionesExcluidasEsFiltroDuro(t *testing.T) {
	d := Donacion{ID: 1, Latitud: latCentro, Longitud: lngCentro, OrganizacionesExcluidas: []int64{100}}
	excluida := candidato(10, 100, latCentro, lngCentro)
	otra := candidato(11, 101, latCentro+0.05, lngCentro)

	res := Ronda([]Donacion{d}, []Candidato{excluida, otra}, PesosPorDefecto, ParametrosPorDefecto)

	if len(res.Asignaciones) != 1 || res.Asignaciones[0].OrganizacionID != 101 {
		t.Fatalf("asignaciones = %+v, want donación matched to organizacion 101 (100 is excluded)",
			res.Asignaciones)
	}
}

// TestRondaPopulaDesglose confirms 5a.10/5a.9: each persisted Asignacion carries the per-criterion
// breakdown, not just the aggregate score.
func TestRondaPopulaDesglose(t *testing.T) {
	d := Donacion{ID: 1, Latitud: latCentro, Longitud: lngCentro}
	c := candidato(10, 100, latCentro, lngCentro)

	res := Ronda([]Donacion{d}, []Candidato{c}, PesosPorDefecto, ParametrosPorDefecto)

	if len(res.Asignaciones) != 1 {
		t.Fatalf("asignaciones = %d, want 1", len(res.Asignaciones))
	}
	got := res.Asignaciones[0].Desglose
	if got.Proximidad == 0 {
		t.Fatalf("Desglose appears empty: %+v", got)
	}
	wantScore := PesosPorDefecto.Deficit*got.Deficit + PesosPorDefecto.Urgencia*got.Urgencia +
		PesosPorDefecto.Proximidad*got.Proximidad + PesosPorDefecto.Espera*got.Espera
	if math.Abs(wantScore-res.Asignaciones[0].Score) > 1e-9 {
		t.Fatalf("weighted desglose = %v, want Score %v", wantScore, res.Asignaciones[0].Score)
	}
}
