package assign

import "sort"

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
// When there are more donations than candidates the matrix is padded with
// dummy columns of zero cost, which the solver hands to the donations that
// lose least by going unallocated.
func Ronda(donaciones []Donacion, candidatos []Candidato, w Pesos, p Parametros) Resultado {
	if len(donaciones) == 0 || len(candidatos) == 0 {
		res := Resultado{}
		for _, d := range donaciones {
			res.SinAsignar = append(res.SinAsignar, d.ID)
		}
		return res
	}

	costo := MatrizCosto(donaciones, candidatos, w, p)

	// Hungarian requires columns >= rows. Dummy columns cost 0, which is worse
	// than any feasible pair (feasible costs are negative scores) and better
	// than Inf, so they are only taken when nothing real is available.
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
			// Unmatched, matched to a dummy column, or matched to an
			// infeasible pair the padding could not absorb.
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
