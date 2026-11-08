package assign

import (
	"math"
	"sort"
)

// Asignacion is one resolved (donacion, necesidad) pair.
type Asignacion struct {
	DonacionID     int64   `json:"donacionId"`
	NecesidadID    int64   `json:"necesidadId"`
	OrganizacionID int64   `json:"organizacionId"`
	Score          float64 `json:"score"`
	DistanciaKm    float64 `json:"distanciaKm"`

	// CostoOportunidad is what the round gave up on this donation to be
	// globally optimal: the best score it could have had on its own, minus the
	// score it actually got. Zero means the round optimum and the greedy pick
	// agree. It is stored so an allocation can be explained after the fact —
	// with Hungarian, "it had the highest score" is not always the reason.
	CostoOportunidad float64 `json:"costoOportunidad"`

	// Desglose is the per-criterion breakdown behind Score (AD-14), persisted
	// so a donante/referente can see why this match happened, not just the
	// aggregate number.
	Desglose Desglose `json:"desglose"`
}

// Resultado is the outcome of one allocation round.
type Resultado struct {
	Asignaciones []Asignacion `json:"asignaciones"`
	// SinAsignar lists donations left over because no feasible candidate
	// remained — either the round ran out of comedores, or every remaining one
	// was filtered out by category or distance.
	SinAsignar []int64 `json:"sinAsignar"`
	// ScoreTotal is the summed score of the matching. It is what Hungarian
	// maximizes, and the number to watch when tuning weights.
	ScoreTotal float64 `json:"scoreTotal"`
}

// Ronda allocates each donation to at most one distinct necesidad, maximizing
// the total score across the whole round.
//
// The one-necesidad-per-donation constraint is what makes this an assignment
// problem rather than independent argmax picks: taking a necesidad denies it
// to every other donation in the round, so the choices are coupled and the
// global optimum is not the sum of the local ones. An organizacion with two
// open necesidades can still receive two donations.
//
// Every donation also gets its own dedicated dummy column (AD-10): leaving it
// unassigned always costs PenalizacionNoAsignar × min(diasEnFondo /
// esperaMaximaDias, 1) rather than nothing, so under contention the donation
// that has waited longer is the one the solver prefers to actually match.
// With PenalizacionNoAsignar = 0 every dummy column costs 0 regardless of
// wait, which reproduces the pre-AD-10 solver exactly (see
// TestPenalizacionCeroReproduceRondaOriginal).
func Ronda(donaciones []Donacion, candidatos []Candidato, w Pesos, p Parametros) Resultado {
	// Canonical order first: the same data in any input order must give the
	// same assignment (RNF16). Donations by id, necesidades by the RN-05 key.
	donaciones = ordenarDonaciones(donaciones)
	candidatos = ordenarCandidatos(candidatos)

	if len(donaciones) == 0 || len(candidatos) == 0 {
		res := Resultado{}
		for _, d := range donaciones {
			res.SinAsignar = append(res.SinAsignar, d.ID)
		}
		return res
	}

	realCols := len(candidatos)
	costo := matrizConDescarte(donaciones, candidatos, w, p, realCols)

	rowToCol, _ := HungarianLex(costo, desempates(costo, realCols))

	res := Resultado{}
	for i, j := range rowToCol {
		d := donaciones[i]
		if j == Unassigned || j >= realCols || costo[i][j] >= 0 {
			// Unmatched, matched to its own dummy column, or matched to an
			// infeasible pair.
			res.SinAsignar = append(res.SinAsignar, d.ID)
			continue
		}
		c := candidatos[j]
		score := -costo[i][j]
		desglose, _, _ := ScoreConDesglose(d, c, w, p)
		res.Asignaciones = append(res.Asignaciones, Asignacion{
			DonacionID:       d.ID,
			NecesidadID:      c.NecesidadID,
			OrganizacionID:   c.OrganizacionID,
			Score:            score,
			DistanciaKm:      distanciaKm(d.Latitud, d.Longitud, c.Latitud, c.Longitud),
			CostoOportunidad: mejorScore(costo[i], realCols) - score,
			Desglose:         desglose,
		})
		res.ScoreTotal += score
	}

	// Total order: score, then necesidad open longest, then lower necesidad id
	// (RN-05), then donation id so even duplicate necesidades cannot reorder.
	rango := make(map[int64]int, len(candidatos))
	for j, c := range candidatos {
		if _, ok := rango[c.NecesidadID]; !ok {
			rango[c.NecesidadID] = j
		}
	}
	sort.SliceStable(res.Asignaciones, func(a, b int) bool {
		x, y := res.Asignaciones[a], res.Asignaciones[b]
		if x.Score != y.Score {
			return x.Score > y.Score
		}
		if rx, ry := rango[x.NecesidadID], rango[y.NecesidadID]; rx != ry {
			return rx < ry
		}
		return x.DonacionID < y.DonacionID
	})
	return res
}

// ordenarDonaciones returns a copy sorted by ascending id.
func ordenarDonaciones(in []Donacion) []Donacion {
	out := append([]Donacion(nil), in...)
	sort.SliceStable(out, func(a, b int) bool { return out[a].ID < out[b].ID })
	return out
}

// ordenarCandidatos returns a copy in RN-05 order: necesidad open longest
// first, then lower id. The index in this order is the necesidad's rank.
func ordenarCandidatos(in []Candidato) []Candidato {
	out := append([]Candidato(nil), in...)
	sort.SliceStable(out, func(a, b int) bool {
		if out[a].DiasAbierta != out[b].DiasAbierta {
			return out[a].DiasAbierta > out[b].DiasAbierta
		}
		return out[a].NecesidadID < out[b].NecesidadID
	})
	return out
}

// desempates builds the RN-05 secondary cost for inputs already in canonical
// order, so a row or column index is also its rank. It only matters among
// matchings with exactly the same total score, and is read in this order:
//
//   - Nivel1 = rank of the necesidad: use the longest-open necesidades
//     (then the lower ids) first.
//   - Nivel2 = rank of the donation: when only some donations fit, match the
//     lower ids.
//   - Nivel3 = (donations - 1 - donation rank) x (necesidad rank + 1): pair
//     the lower donation ids with the better-ranked necesidades
//     (rearrangement inequality).
//
// Infeasible cells and dummy columns carry no secondary cost.
func desempates(costo [][]float64, realCols int) [][]Desempate {
	filas := len(costo)
	out := make([][]Desempate, filas)
	for i := range costo {
		out[i] = make([]Desempate, len(costo[i]))
		for j := 0; j < realCols; j++ {
			if costo[i][j] >= Inf {
				continue
			}
			out[i][j] = Desempate{
				Nivel1: int64(j),
				Nivel2: int64(i),
				Nivel3: int64(filas-1-i) * int64(j+1),
			}
		}
	}
	return out
}

// matrizConDescarte extends MatrizCosto with one dummy column per donation:
// cost costoDescarte(donacion) on its own row, Inf on every other row, so
// Hungarian requires columns >= rows unconditionally (realCols + len(donaciones)
// always >= len(donaciones)) and each donation's "go unmatched" option can
// never be taken by a different donation.
func matrizConDescarte(donaciones []Donacion, candidatos []Candidato, w Pesos, p Parametros, realCols int) [][]float64 {
	base := MatrizCosto(donaciones, candidatos, w, p)
	n := len(donaciones)

	costo := make([][]float64, n)
	for i := range base {
		fila := make([]float64, realCols+n)
		copy(fila, base[i])
		for j := 0; j < n; j++ {
			if j == i {
				fila[realCols+j] = costoDescarte(donaciones[i], p)
			} else {
				fila[realCols+j] = Inf
			}
		}
		costo[i] = fila
	}
	return costo
}

// costoDescarte is the AD-10 unassignment penalty for one donation.
func costoDescarte(d Donacion, p Parametros) float64 {
	if p.PenalizacionNoAsignar == 0 || p.EsperaMaximaDias <= 0 {
		return 0
	}
	fraccion := math.Min(float64(d.DiasEnFondo)/float64(p.EsperaMaximaDias), 1)
	return p.PenalizacionNoAsignar * fraccion
}

// mejorScore is the best score available to one donation ignoring every other
// donation in the round — the greedy pick it would have made alone.
func mejorScore(fila []float64, realCols int) float64 {
	mejor := 0.0
	for j := 0; j < realCols && j < len(fila); j++ {
		if s := -fila[j]; s > mejor {
			mejor = s
		}
	}
	return mejor
}
