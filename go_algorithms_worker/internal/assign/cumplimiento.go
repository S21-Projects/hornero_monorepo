package assign

// PseudoObsPorDefecto is AD-11's default smoothing strength (m): how many "virtual" observations
// of the neutral prior are blended into a candidate's raw history. A request may override it via
// parametros.cumplimientoPseudoObs.
const PseudoObsPorDefecto = 5.0

// ConteoCumplimiento is one candidate's raw resolved-donation counts, as the MS computes them
// (AD-11, 6b): entregadas/fallidas, with CANCELADA and non-terminal donaciones already excluded
// on the MS side. A nil pointer means the candidate sent no cumplimiento at all — equivalent to
// zero counts, so it is never special-cased beyond that.
type ConteoCumplimiento struct {
	Entregadas int
	Fallidas   int
}

// PriorCumplimiento computes p0, the neutral prior (AD-11): the average compliance rate across
// every candidate in this ronda that has resolved history, or 0.5 when none of them do. An
// explicit override (parametros.cumplimientoPrior) always wins, with no computation at all.
func PriorCumplimiento(conteos []*ConteoCumplimiento, override *float64) float64 {
	if override != nil {
		return *override
	}

	var entregadas, total int
	for _, c := range conteos {
		if c == nil {
			continue
		}
		entregadas += c.Entregadas
		total += c.Entregadas + c.Fallidas
	}
	if total == 0 {
		return 0.5
	}
	return float64(entregadas) / float64(total)
}

// TasaCumplimiento applies AD-11's smoothed-rate formula for one candidate:
//
//	tasa = (entregadas + m*p0) / (entregadas + fallidas + m)
//
// A nil conteo (no history at all, whether because the candidate never had one or because the
// producer predates 6b) reduces to exactly p0, since entregadas = fallidas = 0 already makes the
// formula collapse to m*p0/m — no special case is needed to honor the spec's "candidates without
// the field get the neutral prior" rule.
func TasaCumplimiento(conteo *ConteoCumplimiento, p0, m float64) float64 {
	var entregadas, fallidas float64
	if conteo != nil {
		entregadas = float64(conteo.Entregadas)
		fallidas = float64(conteo.Fallidas)
	}
	return (entregadas + m*p0) / (entregadas + fallidas + m)
}
