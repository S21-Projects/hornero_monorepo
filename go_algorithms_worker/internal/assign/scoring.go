package assign

import "math"

// Donacion is one indivisible donation waiting to be allocated in this round.
//
// Only pooled donations reach the solver. A donor who picks a necesidad
// directly bypasses it entirely — that donation is already assigned, and the
// algorithm must never re-route it.
type Donacion struct {
	ID       int64   `json:"id"`
	Latitud  float64 `json:"latitud"`
	Longitud float64 `json:"longitud"`
	// Categoria is the kind of goods offered (e.g. "ALIMENTO_SECO").
	// A candidate that does not accept it is never matched.
	Categoria string `json:"categoria"`

	// DiasEnFondo is how long this donation has waited in the pool. It feeds
	// AD-10's per-donation unassignment penalty: the longer the wait, the
	// costlier it is for the solver to leave this donation unmatched, so an
	// older donation wins a scarce necesidad over a newer one. Zero (the
	// default before any producer sets it) makes the penalty zero too.
	DiasEnFondo int `json:"diasEnFondo"`

	// OrganizacionesExcluidas is a hard filter: organizaciones that already
	// rejected (devolución al fondo, AD-3) this exact donation. The solver
	// must never re-propose it to them, regardless of score.
	OrganizacionesExcluidas []int64 `json:"organizacionesExcluidas,omitempty"`
}

// Candidato is one open necesidad competing for a donation.
//
// The candidate is the necesidad, not the organizacion. Scoring the
// organizacion would produce a ranking rather than an allocation: the same
// well-rated comedor would win every donation, including goods it never asked
// for. Keying on the necesidad also lets one organizacion receive two
// donations in a round when it has two distinct open necesidades, which is the
// correct behaviour.
type Candidato struct {
	NecesidadID    int64 `json:"necesidadId"`
	OrganizacionID int64 `json:"organizacionId"`

	// Coordinates of the organizacion that published the necesidad.
	Latitud  float64 `json:"latitud"`
	Longitud float64 `json:"longitud"`

	// CodigoRadio is the 9-digit INDEC census radio the organizacion sits in.
	CodigoRadio string `json:"codigoRadio"`

	// Deficit is the coverage shortfall of that radio, as a ratio against the
	// city median (1.0 = median, 2.0 = twice as underserved).
	Deficit float64 `json:"deficit"`

	// Urgencia is the priority of this necesidad, in [0, 1], derived from its
	// prioridad and how close fechaVencimiento is.
	Urgencia float64 `json:"urgencia"`

	// DiasDesdeUltimaDonacion is the anti-starvation input, measured per
	// organizacion rather than per necesidad.
	//
	// It MUST count direct donations too, even though those never pass through
	// this solver. An organizacion with many direct donors would otherwise
	// look starved to the algorithm and be prioritized in the pool as well,
	// collecting from both channels at once — the opposite of the fairness
	// this term exists to enforce.
	DiasDesdeUltimaDonacion int `json:"diasDesdeUltimaDonacion"`

	// CategoriasAceptadas restricts what the necesidad can absorb. Empty means
	// it accepts anything.
	CategoriasAceptadas []string `json:"categoriasAceptadas,omitempty"`

	// CategoriasPermitidas is the set the organizacion's accreditation level
	// allows it to receive (AD-10). It is distinct from CategoriasAceptadas on
	// purpose: CategoriasAceptadas is what the necesidad asked for,
	// CategoriasPermitidas is what the level allows. Empty means uncapped,
	// matching CategoriasAceptadas's own empty-means-anything rule — this is
	// what makes the field additive and behaviour-neutral until a producer
	// sets it.
	CategoriasPermitidas []string `json:"categoriasPermitidas,omitempty"`

	// TasaCumplimiento is the candidate's smoothed compliance rate (AD-11), already resolved to a
	// plain [0, 1] value by the time it reaches the solver — either from its own history or the
	// ronda's neutral prior. The zero value (unset) is a deliberately inert 0% contribution for
	// any caller that constructs a Candidato directly without going through the contrato mapping
	// layer, which is what keeps every pre-6a test unaffected: the weighted term it adds is
	// Cumplimiento weight * 0 = 0.
	TasaCumplimiento float64 `json:"-"`
}

// Pesos weights the five scoring terms. They need not sum to 1 — Normalizados() divides by the
// sum so any configuration still reads as a 0-1 quality.
type Pesos struct {
	Deficit      float64 `json:"deficit"`
	Urgencia     float64 `json:"urgencia"`
	Proximidad   float64 `json:"proximidad"`
	Espera       float64 `json:"espera"`
	Cumplimiento float64 `json:"cumplimiento"`
}

// Normalizados divides every term by their sum (AD-11), so the five weights always read as a 0-1
// contribution regardless of how a caller configured them — including the degenerate case where
// Cumplimiento is weighted at 0, which must reduce the remaining four back to exactly their own
// ratios. The zero-sum case (every weight 0) is returned unchanged rather than dividing by zero.
func (w Pesos) Normalizados() Pesos {
	suma := w.Deficit + w.Urgencia + w.Proximidad + w.Espera + w.Cumplimiento
	if suma == 0 {
		return w
	}
	return Pesos{
		Deficit:      w.Deficit / suma,
		Urgencia:     w.Urgencia / suma,
		Proximidad:   w.Proximidad / suma,
		Espera:       w.Espera / suma,
		Cumplimiento: w.Cumplimiento / suma,
	}
}

// Desglose is the per-criterion breakdown behind one Score call, each term
// already normalized to [0, 1] before Pesos is applied. It is what makes a
// match explainable: the same numbers get persisted on Asignacion and shown
// to donantes/referentes as "why this match".
type Desglose struct {
	Deficit      float64 `json:"deficit"`
	Urgencia     float64 `json:"urgencia"`
	Proximidad   float64 `json:"proximidad"`
	Espera       float64 `json:"espera"`
	Cumplimiento float64 `json:"cumplimiento"`
}

// PesosPorDefecto favours coverage deficit, with a meaningful anti-starvation
// term so no comedor can be starved by permanently losing on the other three,
// and a compliance-history term (AD-11) that rewards organizaciones with a
// reliable delivery record without ever hard-filtering on it. Already sums to
// 1, so Normalizados() is a no-op on these exact values.
var PesosPorDefecto = Pesos{
	Deficit:      0.30,
	Urgencia:     0.25,
	Proximidad:   0.17,
	Espera:       0.13,
	Cumplimiento: 0.15,
}

// Parametros holds the normalization constants. Every raw input lives on a
// different scale — kilometres, ratios, days — so each is mapped into [0, 1]
// before the weights are applied. Skipping this is the usual reason a weighted
// score behaves nothing like its weights suggest.
type Parametros struct {
	// DistanciaMediaKm is the decay constant of the proximity term: a
	// candidate this far away scores about 0.37 on proximity.
	DistanciaMediaKm float64 `json:"distanciaMediaKm"`
	// DistanciaMaximaKm hard-filters candidates that are simply too far.
	DistanciaMaximaKm float64 `json:"distanciaMaximaKm"`
	// EsperaMaximaDias is the wait at which the anti-starvation term saturates.
	EsperaMaximaDias int `json:"esperaMaximaDias"`
	// DeficitMaximo clamps the deficit ratio before normalizing, so a single
	// extreme radio cannot flatten every other candidate.
	DeficitMaximo float64 `json:"deficitMaximo"`

	// PenalizacionNoAsignar is the AD-10 unassignment penalty: the cost of
	// the per-donation dummy column at full wait (DiasEnFondo >=
	// EsperaMaximaDias). Zero reproduces the pre-AD-10 solver exactly — see
	// TestPenalizacionCeroReproduceRondaOriginal.
	PenalizacionNoAsignar float64 `json:"penalizacionNoAsignar"`

	// CumplimientoPseudoObs is AD-11's smoothing strength m (see PseudoObsPorDefecto). Echoed
	// back on the response's parametros, like every other normalization constant.
	CumplimientoPseudoObs float64 `json:"cumplimientoPseudoObs"`
}

// ParametrosPorDefecto are tuned for a city-sized round (Córdoba).
var ParametrosPorDefecto = Parametros{
	DistanciaMediaKm:      8,
	DistanciaMaximaKm:     30,
	EsperaMaximaDias:      90,
	DeficitMaximo:         3,
	CumplimientoPseudoObs: PseudoObsPorDefecto,
	PenalizacionNoAsignar: 0.10,
}

const radioTierraKm = 6371

// distanciaKm is the Haversine distance between two coordinates.
func distanciaKm(lat1, lng1, lat2, lng2 float64) float64 {
	rad := func(d float64) float64 { return d * math.Pi / 180 }
	dLat := rad(lat2 - lat1)
	dLng := rad(lng2 - lng1)
	h := math.Pow(math.Sin(dLat/2), 2) +
		math.Cos(rad(lat1))*math.Cos(rad(lat2))*math.Pow(math.Sin(dLng/2), 2)
	return 2 * radioTierraKm * math.Asin(math.Sqrt(h))
}

func (c Candidato) acepta(categoria string) bool {
	if !c.aceptaSegun(c.CategoriasAceptadas, categoria) {
		return false
	}
	return c.aceptaSegun(c.CategoriasPermitidas, categoria)
}

// aceptaSegun is the shared membership check behind both CategoriasAceptadas
// (what the necesidad asked for) and CategoriasPermitidas (what the
// accreditation level allows, AD-10) — kept as two distinct fields on
// Candidato, but the same "empty means anything" rule for both.
func (c Candidato) aceptaSegun(conjunto []string, categoria string) bool {
	if len(conjunto) == 0 || categoria == "" {
		return true
	}
	for _, permitida := range conjunto {
		if permitida == categoria {
			return true
		}
	}
	return false
}

// Score rates a single donation-candidate pair in [0, 1], higher being better.
// It returns false when the pair is infeasible and must not be matched.
//
// It is a thin delegation to ScoreConDesglose, kept so existing callers that
// only need the aggregate number are unaffected by AD-14's breakdown.
func Score(d Donacion, c Candidato, w Pesos, p Parametros) (float64, bool) {
	_, score, ok := ScoreConDesglose(d, c, w, p)
	return score, ok
}

// ScoreConDesglose rates a single donation-candidate pair and also returns the
// per-criterion terms behind that score (Desglose), each normalized to
// [0, 1] before Pesos is applied. It returns ok = false, and the zero
// Desglose, when the pair is infeasible and must not be matched.
func ScoreConDesglose(d Donacion, c Candidato, w Pesos, p Parametros) (Desglose, float64, bool) {
	if estaExcluida(d.OrganizacionesExcluidas, c.OrganizacionID) {
		return Desglose{}, 0, false
	}
	if !c.acepta(d.Categoria) {
		return Desglose{}, 0, false
	}

	km := distanciaKm(d.Latitud, d.Longitud, c.Latitud, c.Longitud)
	if p.DistanciaMaximaKm > 0 && km > p.DistanciaMaximaKm {
		return Desglose{}, 0, false
	}

	// Exponential decay: nearby candidates are strongly preferred, but the
	// term never collapses to zero, so a far comedor in a starved radio can
	// still win on the other three terms.
	desglose := Desglose{
		Proximidad:   math.Exp(-km / p.DistanciaMediaKm),
		Deficit:      math.Min(c.Deficit, p.DeficitMaximo) / p.DeficitMaximo,
		Urgencia:     math.Max(0, math.Min(c.Urgencia, 1)),
		Espera:       math.Min(float64(c.DiasDesdeUltimaDonacion)/float64(p.EsperaMaximaDias), 1),
		Cumplimiento: c.TasaCumplimiento,
	}

	pesos := w.Normalizados()
	score := pesos.Deficit*desglose.Deficit +
		pesos.Urgencia*desglose.Urgencia +
		pesos.Proximidad*desglose.Proximidad +
		pesos.Espera*desglose.Espera +
		pesos.Cumplimiento*desglose.Cumplimiento

	return desglose, score, true
}

// estaExcluida reports whether organizacionID is a member of excluidas — the
// AD-3/AD-10 devolución-al-fondo hard filter.
func estaExcluida(excluidas []int64, organizacionID int64) bool {
	for _, id := range excluidas {
		if id == organizacionID {
			return true
		}
	}
	return false
}

// MatrizCosto builds the cost matrix the solver minimizes. Scores are negated
// because Hungarian minimizes, and infeasible pairs get Inf so the matching
// only ever picks them when a donation has no feasible candidate at all.
func MatrizCosto(donaciones []Donacion, candidatos []Candidato, w Pesos, p Parametros) [][]float64 {
	costo := make([][]float64, len(donaciones))
	for i, d := range donaciones {
		costo[i] = make([]float64, len(candidatos))
		for j, c := range candidatos {
			score, ok := Score(d, c, w, p)
			if !ok {
				costo[i][j] = Inf
				continue
			}
			costo[i][j] = -score
		}
	}
	return costo
}
