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
}

// Pesos weights the four scoring terms. They need not sum to 1, but keeping
// them normalized makes the resulting score readable as a 0-1 quality.
type Pesos struct {
	Deficit    float64 `json:"deficit"`
	Urgencia   float64 `json:"urgencia"`
	Proximidad float64 `json:"proximidad"`
	Espera     float64 `json:"espera"`
}

// PesosPorDefecto favours coverage deficit, with a meaningful anti-starvation
// term so no comedor can be starved by permanently losing on the other three.
var PesosPorDefecto = Pesos{
	Deficit:    0.35,
	Urgencia:   0.30,
	Proximidad: 0.20,
	Espera:     0.15,
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
}

// ParametrosPorDefecto are tuned for a city-sized round (Córdoba).
var ParametrosPorDefecto = Parametros{
	DistanciaMediaKm:  8,
	DistanciaMaximaKm: 30,
	EsperaMaximaDias:  90,
	DeficitMaximo:     3,
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
func Score(d Donacion, c Candidato, w Pesos, p Parametros) (float64, bool) {
	if !c.acepta(d.Categoria) {
		return 0, false
	}

	km := distanciaKm(d.Latitud, d.Longitud, c.Latitud, c.Longitud)
	if p.DistanciaMaximaKm > 0 && km > p.DistanciaMaximaKm {
		return 0, false
	}

	// Exponential decay: nearby candidates are strongly preferred, but the
	// term never collapses to zero, so a far comedor in a starved radio can
	// still win on the other three terms.
	proximidad := math.Exp(-km / p.DistanciaMediaKm)

	deficit := math.Min(c.Deficit, p.DeficitMaximo) / p.DeficitMaximo
	urgencia := math.Max(0, math.Min(c.Urgencia, 1))
	espera := math.Min(float64(c.DiasDesdeUltimaDonacion)/float64(p.EsperaMaximaDias), 1)

	score := w.Deficit*deficit +
		w.Urgencia*urgencia +
		w.Proximidad*proximidad +
		w.Espera*espera

	return score, true
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
