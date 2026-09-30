// Package geo resolves AD-2's coverage-deficit term for one ronda candidate: given a necesidad's
// coordinates and (optionally) its organizacion's census radio, it decides which deficit number to
// score with and records which rule produced it.
package geo

import (
	"math"

	"algorithms/internal/metrics"
	"algorithms/internal/renacom"
)

// Fuente names the AD-2 rule that produced a resolved deficit, so the ronda output can explain
// where each candidate's coverage number came from.
type Fuente string

const (
	// FuenteProvisto: the ronda request carried an explicit deficit for this candidate.
	FuenteProvisto Fuente = "PROVISTO"
	// FuenteRadio: the candidate's own codigoRadio is known and its deficit is positive.
	FuenteRadio Fuente = "RADIO"
	// FuenteCercano: no usable codigoRadio, but a precise RENACOM point within the resolution
	// radius sits in a radio with positive deficit.
	FuenteCercano Fuente = "CERCANO"
	// FuenteNeutral: none of the above — the candidate scores the median (no distortion).
	FuenteNeutral Fuente = "NEUTRAL"
)

// Neutral is the deficit value used when nothing better is known: the median by definition.
const Neutral = 1.0

// Punto is one precise-enough RENACOM point usable for CERCANO resolution.
type Punto struct {
	Latitud     float64
	Longitud    float64
	CodigoRadio string
}

// Resolvedor answers AD-2's deficit-resolution question for one ronda. It is built once at
// worker startup (RENACOM plus the optional census CSV never change while the process runs) and
// reused for every request.
type Resolvedor struct {
	porRadio          map[string]float64
	puntos            []Punto
	radioResolucionKm float64
}

// NuevoResolvedor builds a Resolvedor from a precomputed per-radio deficit map (e.g.
// metrics.Agregar's output) and the set of precise RENACOM points. radioResolucionKm <= 0 falls
// back to the documented 1.0 km default.
func NuevoResolvedor(porRadio map[string]float64, puntos []Punto, radioResolucionKm float64) *Resolvedor {
	if radioResolucionKm <= 0 {
		radioResolucionKm = 1.0
	}
	return &Resolvedor{porRadio: porRadio, puntos: puntos, radioResolucionKm: radioResolucionKm}
}

// Cargar builds a Resolvedor straight from the RENACOM CSV and an optional census population
// CSV, the way the worker's `serve` command does at startup. poblacionPath == "" is the
// documented known limitation: every radio's deficit stays 0, so every candidate resolves to
// NEUTRAL until the INDEC CSV is mounted. provincia == "" skips the province filter.
func Cargar(renacomPath, poblacionPath, provincia string, radioResolucionKm float64) (*Resolvedor, error) {
	comedores, err := renacom.Cargar(renacomPath)
	if err != nil {
		return nil, err
	}
	if provincia != "" {
		comedores = renacom.FiltrarProvincia(comedores, provincia)
	}

	var poblacion map[string]metrics.Poblacion
	if poblacionPath != "" {
		if poblacion, err = metrics.CargarPoblacion(poblacionPath); err != nil {
			return nil, err
		}
	}

	radios := metrics.Agregar(comedores, poblacion)
	porRadio := make(map[string]float64, len(radios))
	for _, r := range radios {
		porRadio[r.CodigoRadio] = r.Deficit
	}

	var puntos []Punto
	for _, c := range comedores {
		if c.CodigoRadio == "" || c.PrecisionDudosa() {
			continue
		}
		puntos = append(puntos, Punto{Latitud: c.Latitud, Longitud: c.Longitud, CodigoRadio: c.CodigoRadio})
	}

	return NuevoResolvedor(porRadio, puntos, radioResolucionKm), nil
}

// Resolver applies the AD-2 precedence table for one candidate: PROVISTO (provisto != nil) >
// RADIO (codigoRadio known with positive deficit) > CERCANO (nearest precise point within the
// resolution radius whose radio has positive deficit) > NEUTRAL.
func (r *Resolvedor) Resolver(lat, lng float64, codigoRadio string, provisto *float64) (float64, Fuente) {
	if provisto != nil {
		return *provisto, FuenteProvisto
	}
	if codigoRadio != "" {
		if d, ok := r.porRadio[codigoRadio]; ok && d > 0 {
			return d, FuenteRadio
		}
	}
	if d, ok := r.cercano(lat, lng); ok {
		return d, FuenteCercano
	}
	return Neutral, FuenteNeutral
}

// cercano scans every precise point for the closest one, within radioResolucionKm, whose radio
// carries a positive deficit. Linear is fine here: RENACOM has on the order of a few thousand
// points and a ronda has on the order of a hundred candidates (AD-2's own rationale).
func (r *Resolvedor) cercano(lat, lng float64) (float64, bool) {
	mejorDist := math.Inf(1)
	var mejorDeficit float64
	encontrado := false

	for _, p := range r.puntos {
		d, ok := r.porRadio[p.CodigoRadio]
		if !ok || d <= 0 {
			continue
		}
		dist := distanciaKm(lat, lng, p.Latitud, p.Longitud)
		if dist > r.radioResolucionKm || dist >= mejorDist {
			continue
		}
		mejorDist = dist
		mejorDeficit = d
		encontrado = true
	}
	return mejorDeficit, encontrado
}

const radioTierraKm = 6371

// distanciaKm is the Haversine distance between two coordinates — kept local to this package to
// avoid exporting internal/assign's identical helper just for this one caller.
func distanciaKm(lat1, lng1, lat2, lng2 float64) float64 {
	rad := func(d float64) float64 { return d * math.Pi / 180 }
	dLat := rad(lat2 - lat1)
	dLng := rad(lng2 - lng1)
	h := math.Pow(math.Sin(dLat/2), 2) +
		math.Cos(rad(lat1))*math.Cos(rad(lat2))*math.Pow(math.Sin(dLng/2), 2)
	return 2 * radioTierraKm * math.Asin(math.Sqrt(h))
}
