// Package contrato is the worker's versioned, additive-only wire contract (AD-14). It decodes
// and validates the v1 ronda request and maps it onto the unchanged internal/assign types —
// "absent vs zero" (e.g. an un-provided deficit) is a wire-only concern that lives here, never
// leaking into internal/assign's plain float64 fields.
package contrato

import (
	"fmt"
	"math"

	"algorithms/internal/assign"
	"algorithms/internal/geo"
)

// VersionSoportada is the only major version this worker accepts today. A breaking change to the
// contract ships as /v2/ronda, not a bump of this constant.
const VersionSoportada = 1

// limiteItems caps donaciones/candidatos per request (AD-14) — generous for a city-sized ronda,
// small enough that a pathological request cannot make the O(n^2 m) Hungarian solve pathological
// either.
const limiteItems = 500

// ErrorContrato is the typed validation failure behind the handler's `{error, detalle}` envelope.
type ErrorContrato struct {
	Codigo  string
	Detalle string
}

func (e *ErrorContrato) Error() string { return e.Codigo + ": " + e.Detalle }

func errVersion(detalle string) error {
	return &ErrorContrato{Codigo: "VERSION_NO_SOPORTADA", Detalle: detalle}
}

func errEntrada(detalle string) error {
	return &ErrorContrato{Codigo: "ENTRADA_INVALIDA", Detalle: detalle}
}

// EntradaRondaV1 is the wire shape of `POST /v1/ronda`.
type EntradaRondaV1 struct {
	Version    int           `json:"version"`
	Donaciones []DonacionV1  `json:"donaciones"`
	Candidatos []CandidatoV1 `json:"candidatos"`
	Pesos      *assign.Pesos `json:"pesos,omitempty"`
	Parametros *ParametrosV1 `json:"parametros,omitempty"`
}

// DonacionV1 is one pooled donation waiting to be allocated.
type DonacionV1 struct {
	ID                      int64   `json:"id"`
	Latitud                 float64 `json:"latitud"`
	Longitud                float64 `json:"longitud"`
	Categoria               string  `json:"categoria"`
	DiasEnFondo             int     `json:"diasEnFondo"`
	OrganizacionesExcluidas []int64 `json:"organizacionesExcluidas,omitempty"`
}

// CandidatoV1 is one open candidate necesidad competing for a donation.
//
// Deficit is a pointer because AD-2 needs to distinguish "the caller did not send a deficit" from
// "the caller sent exactly 0.0" — the former lets the worker resolve it (RADIO/CERCANO/NEUTRAL),
// the latter is a PROVISTO override of zero.
type CandidatoV1 struct {
	NecesidadID             int64    `json:"necesidadId"`
	OrganizacionID          int64    `json:"organizacionId"`
	Latitud                 float64  `json:"latitud"`
	Longitud                float64  `json:"longitud"`
	CodigoRadio             string   `json:"codigoRadio,omitempty"`
	Deficit                 *float64 `json:"deficit,omitempty"`
	Urgencia                float64  `json:"urgencia"`
	DiasDesdeUltimaDonacion int      `json:"diasDesdeUltimaDonacion"`
	CategoriasAceptadas     []string `json:"categoriasAceptadas,omitempty"`
	CategoriasPermitidas    []string `json:"categoriasPermitidas,omitempty"`

	// Cumplimiento is the candidate organizacion's raw resolved-donation counts (AD-11, 6b). nil
	// means the producer sent none — either it predates 6b or the organizacion has no history —
	// and the worker treats that exactly like {0, 0}, resolving to the ronda's neutral prior.
	Cumplimiento *CumplimientoV1 `json:"cumplimiento,omitempty"`
}

// CumplimientoV1 is one candidate's raw compliance counts, additive in 6a (AD-11). The MS
// classifies ENTREGADA as entregada, RECHAZADA as fallida, and excludes CANCELADA and any
// non-terminal donacion from both — the worker only ever sees already-classified counts.
type CumplimientoV1 struct {
	Entregadas int `json:"entregadas"`
	Fallidas   int `json:"fallidas"`
}

// ParametrosV1 is the optional per-request override of the normalization constants. Every field
// is a pointer so "omitted" (use the worker default) is distinguishable from "explicitly zero".
type ParametrosV1 struct {
	DistanciaMediaKm      *float64 `json:"distanciaMediaKm,omitempty"`
	DistanciaMaximaKm     *float64 `json:"distanciaMaximaKm,omitempty"`
	EsperaMaximaDias      *int     `json:"esperaMaximaDias,omitempty"`
	DeficitMaximo         *float64 `json:"deficitMaximo,omitempty"`
	PenalizacionNoAsignar *float64 `json:"penalizacionNoAsignar,omitempty"`
	RadioResolucionKm     *float64 `json:"radioResolucionKm,omitempty"`

	// CumplimientoPseudoObs overrides AD-11's smoothing strength m (default
	// assign.PseudoObsPorDefecto). Consumed in 6a by ACandidatos.
	CumplimientoPseudoObs *float64 `json:"cumplimientoPseudoObs,omitempty"`

	// CumplimientoPrior overrides AD-11's neutral prior p0 — the ronda-wide average compliance
	// rate the worker would otherwise compute itself. Consumed in 6a by ACandidatos.
	CumplimientoPrior *float64 `json:"cumplimientoPrior,omitempty"`
}

// Validar runs every AD-14 wire-level check: supported major version, item-count limits, and
// finite in-range coordinates. categoria strings are intentionally never checked against a
// vocabulary — an unrecognized-but-present value must pass through untouched, per AD-14 and the
// ronda-asignacion spec.
func (e EntradaRondaV1) Validar() error {
	if e.Version != VersionSoportada {
		return errVersion(fmt.Sprintf("version %d no soportada, esperada %d", e.Version, VersionSoportada))
	}
	if len(e.Donaciones) > limiteItems {
		return errEntrada(fmt.Sprintf("donaciones = %d, maximo %d", len(e.Donaciones), limiteItems))
	}
	if len(e.Candidatos) > limiteItems {
		return errEntrada(fmt.Sprintf("candidatos = %d, maximo %d", len(e.Candidatos), limiteItems))
	}
	for _, d := range e.Donaciones {
		if !coordenadaValida(d.Latitud, d.Longitud) {
			return errEntrada(fmt.Sprintf("donacion %d: coordenadas invalidas (%v, %v)", d.ID, d.Latitud, d.Longitud))
		}
	}
	for _, c := range e.Candidatos {
		if !coordenadaValida(c.Latitud, c.Longitud) {
			return errEntrada(fmt.Sprintf("candidato (necesidad %d): coordenadas invalidas (%v, %v)", c.NecesidadID, c.Latitud, c.Longitud))
		}
	}
	return nil
}

func coordenadaValida(lat, lng float64) bool {
	if math.IsNaN(lat) || math.IsNaN(lng) || math.IsInf(lat, 0) || math.IsInf(lng, 0) {
		return false
	}
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// ADonaciones maps the wire donaciones onto the unchanged assign.Donacion.
func (e EntradaRondaV1) ADonaciones() []assign.Donacion {
	out := make([]assign.Donacion, len(e.Donaciones))
	for i, d := range e.Donaciones {
		out[i] = assign.Donacion{
			ID:                      d.ID,
			Latitud:                 d.Latitud,
			Longitud:                d.Longitud,
			Categoria:               d.Categoria,
			DiasEnFondo:             d.DiasEnFondo,
			OrganizacionesExcluidas: d.OrganizacionesExcluidas,
		}
	}
	return out
}

// CandidatoResuelto pairs a mapped assign.Candidato with the AD-2 metadata (Fuente, CodigoRadio)
// the response needs to report per assignment.
type CandidatoResuelto struct {
	Fuente      geo.Fuente
	CodigoRadio string
}

// ACandidatos maps the wire candidatos onto assign.Candidato, resolving each one's coverage
// deficit through resolvedor (AD-2) and compliance rate through AD-11's smoothed-rate formula.
// pseudoObs is the already-resolved m (ResolverParametros's CumplimientoPseudoObs, defaulted or
// overridden) — passed in rather than re-resolved here so there is exactly one place that merges
// the request's ParametrosV1 onto the defaults. It also returns, per necesidadId, which rule
// produced that deficit — the handler needs it to fill deficitFuente/codigoRadio on matched
// assignments.
func (e EntradaRondaV1) ACandidatos(resolvedor *geo.Resolvedor, pseudoObs float64) ([]assign.Candidato, map[int64]CandidatoResuelto) {
	out := make([]assign.Candidato, len(e.Candidatos))
	meta := make(map[int64]CandidatoResuelto, len(e.Candidatos))

	conteos := make([]*assign.ConteoCumplimiento, len(e.Candidatos))
	for i, c := range e.Candidatos {
		if c.Cumplimiento != nil {
			conteos[i] = &assign.ConteoCumplimiento{
				Entregadas: c.Cumplimiento.Entregadas,
				Fallidas:   c.Cumplimiento.Fallidas,
			}
		}
	}
	var priorOverride *float64
	if e.Parametros != nil {
		priorOverride = e.Parametros.CumplimientoPrior
	}
	p0 := assign.PriorCumplimiento(conteos, priorOverride)

	for i, c := range e.Candidatos {
		deficit, fuente := resolvedor.Resolver(c.Latitud, c.Longitud, c.CodigoRadio, c.Deficit)
		out[i] = assign.Candidato{
			NecesidadID:             c.NecesidadID,
			OrganizacionID:          c.OrganizacionID,
			Latitud:                 c.Latitud,
			Longitud:                c.Longitud,
			CodigoRadio:             c.CodigoRadio,
			Deficit:                 deficit,
			Urgencia:                c.Urgencia,
			DiasDesdeUltimaDonacion: c.DiasDesdeUltimaDonacion,
			CategoriasAceptadas:     c.CategoriasAceptadas,
			CategoriasPermitidas:    c.CategoriasPermitidas,
			TasaCumplimiento:        assign.TasaCumplimiento(conteos[i], p0, pseudoObs),
		}
		meta[c.NecesidadID] = CandidatoResuelto{Fuente: fuente, CodigoRadio: c.CodigoRadio}
	}
	return out, meta
}

// ResolverPesos returns the request's Pesos override, or assign.PesosPorDefecto.
func (e EntradaRondaV1) ResolverPesos() assign.Pesos {
	if e.Pesos != nil {
		return *e.Pesos
	}
	return assign.PesosPorDefecto
}

// ResolverParametros merges the request's optional ParametrosV1 override onto
// assign.ParametrosPorDefecto and returns the effective radioResolucionKm (AD-2) alongside it —
// that one does not live on assign.Parametros, it belongs to the geo.Resolvedor.
func (e EntradaRondaV1) ResolverParametros() (assign.Parametros, float64) {
	p := assign.ParametrosPorDefecto
	radioResolucionKm := 1.0

	if e.Parametros == nil {
		return p, radioResolucionKm
	}
	v := e.Parametros
	if v.DistanciaMediaKm != nil {
		p.DistanciaMediaKm = *v.DistanciaMediaKm
	}
	if v.DistanciaMaximaKm != nil {
		p.DistanciaMaximaKm = *v.DistanciaMaximaKm
	}
	if v.EsperaMaximaDias != nil {
		p.EsperaMaximaDias = *v.EsperaMaximaDias
	}
	if v.DeficitMaximo != nil {
		p.DeficitMaximo = *v.DeficitMaximo
	}
	if v.PenalizacionNoAsignar != nil {
		p.PenalizacionNoAsignar = *v.PenalizacionNoAsignar
	}
	if v.CumplimientoPseudoObs != nil {
		p.CumplimientoPseudoObs = *v.CumplimientoPseudoObs
	}
	if v.RadioResolucionKm != nil {
		radioResolucionKm = *v.RadioResolucionKm
	}
	return p, radioResolucionKm
}

// SalidaRondaV1 is the wire shape of a successful `POST /v1/ronda` response.
type SalidaRondaV1 struct {
	Version      int               `json:"version"`
	Asignaciones []AsignacionV1    `json:"asignaciones"`
	SinAsignar   []int64           `json:"sinAsignar"`
	ScoreTotal   float64           `json:"scoreTotal"`
	Pesos        assign.Pesos      `json:"pesos"`
	Parametros   assign.Parametros `json:"parametros"`
}

// AsignacionV1 is one matched (donacion, necesidad) pair in the response.
type AsignacionV1 struct {
	DonacionID       int64           `json:"donacionId"`
	NecesidadID      int64           `json:"necesidadId"`
	OrganizacionID   int64           `json:"organizacionId"`
	Score            float64         `json:"score"`
	DistanciaKm      float64         `json:"distanciaKm"`
	CostoOportunidad float64         `json:"costoOportunidad"`
	Desglose         assign.Desglose `json:"desglose"`
	DeficitFuente    string          `json:"deficitFuente"`
	CodigoRadio      string          `json:"codigoRadio"`
}

// AResultado builds the SalidaRondaV1 that the handler encodes as the response body for a
// solved resultado, filling deficitFuente/codigoRadio per assignment from meta (ACandidatos's
// second return value).
func AResultado(resultado assign.Resultado, meta map[int64]CandidatoResuelto, pesos assign.Pesos, parametros assign.Parametros) SalidaRondaV1 {
	asignaciones := make([]AsignacionV1, len(resultado.Asignaciones))
	for i, a := range resultado.Asignaciones {
		m := meta[a.NecesidadID]
		asignaciones[i] = AsignacionV1{
			DonacionID:       a.DonacionID,
			NecesidadID:      a.NecesidadID,
			OrganizacionID:   a.OrganizacionID,
			Score:            a.Score,
			DistanciaKm:      a.DistanciaKm,
			CostoOportunidad: a.CostoOportunidad,
			Desglose:         a.Desglose,
			DeficitFuente:    string(m.Fuente),
			CodigoRadio:      m.CodigoRadio,
		}
	}
	sinAsignar := resultado.SinAsignar
	if sinAsignar == nil {
		sinAsignar = []int64{}
	}
	return SalidaRondaV1{
		Version:      VersionSoportada,
		Asignaciones: asignaciones,
		SinAsignar:   sinAsignar,
		ScoreTotal:   resultado.ScoreTotal,
		Pesos:        pesos,
		Parametros:   parametros,
	}
}
