// Package api is the worker's HTTP entrypoint (AD-1): POST /v1/ronda runs one allocation round
// over the contrato/assign pipeline, POST /v1/radio resolves a point to its census radio, GET
// /healthz backs the compose healthcheck.
package api

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"

	"algorithms/internal/assign"
	"algorithms/internal/contrato"
	"algorithms/internal/geo"
	"algorithms/internal/radios"
)

// maxBodyBytes is AD-14's body-size limit: 1 MiB is generous for 500 donaciones/candidatos and
// small enough that an oversized request cannot pressure the worker's memory.
const maxBodyBytes = 1 << 20

// maxBodyRadioBytes caps POST /v1/radio: its body is two numbers.
const maxBodyRadioBytes = 4 << 10

// Handler serves the v1 worker contract. It is built once at startup around the
// geo.Resolvedor loaded from RENACOM (and, optionally, the census CSV) and reused for every
// request — the whole reason the worker is a long-lived process rather than a CLI call per
// ronda (AD-1's rationale).
type Handler struct {
	resolvedor *geo.Resolvedor
	radios     *radios.Indice
}

// NuevoHandler builds a Handler around resolvedor and the census radios index. indice may be nil
// (asset missing or not configured): POST /v1/radio then answers 503 and rondas are unaffected.
func NuevoHandler(resolvedor *geo.Resolvedor, indice *radios.Indice) *Handler {
	return &Handler{resolvedor: resolvedor, radios: indice}
}

// Rutas registers the worker's HTTP endpoints.
func (h *Handler) Rutas() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/ronda", h.ronda)
	mux.HandleFunc("/v1/radio", h.radio)
	mux.HandleFunc("/healthz", h.healthz)
	return mux
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (h *Handler) ronda(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		escribirError(w, http.StatusMethodNotAllowed, "METODO_NO_PERMITIDO", "usar POST")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	var entrada contrato.EntradaRondaV1
	if err := json.NewDecoder(r.Body).Decode(&entrada); err != nil {
		if esCuerpoDemasiadoGrande(err) {
			escribirError(w, http.StatusRequestEntityTooLarge, "CUERPO_DEMASIADO_GRANDE", err.Error())
			return
		}
		escribirError(w, http.StatusBadRequest, "ENTRADA_INVALIDA", err.Error())
		return
	}

	if err := entrada.Validar(); err != nil {
		var ec *contrato.ErrorContrato
		if errors.As(err, &ec) {
			escribirError(w, http.StatusBadRequest, ec.Codigo, ec.Detalle)
			return
		}
		escribirError(w, http.StatusBadRequest, "ENTRADA_INVALIDA", err.Error())
		return
	}

	pesos := entrada.ResolverPesos()
	parametros, _ := entrada.ResolverParametros() // radioResolucionKm: see the ResolverParametros deviation note.

	donaciones := entrada.ADonaciones()
	candidatos, meta := entrada.ACandidatos(h.resolvedor, parametros.CumplimientoPseudoObs)

	resultado := assign.Ronda(donaciones, candidatos, pesos, parametros)
	salida := contrato.AResultado(resultado, meta, pesos, parametros)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(salida)
}

type radioRequest struct {
	Latitud  *float64 `json:"latitud"`
	Longitud *float64 `json:"longitud"`
}

// radio answers which 2022 census radio contains the posted point.
func (h *Handler) radio(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		escribirError(w, http.StatusMethodNotAllowed, "METODO_NO_PERMITIDO", "usar POST")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodyRadioBytes)

	var entrada radioRequest
	if err := json.NewDecoder(r.Body).Decode(&entrada); err != nil {
		if esCuerpoDemasiadoGrande(err) {
			escribirError(w, http.StatusRequestEntityTooLarge, "CUERPO_DEMASIADO_GRANDE", err.Error())
			return
		}
		escribirError(w, http.StatusBadRequest, "ENTRADA_INVALIDA", err.Error())
		return
	}
	if entrada.Latitud == nil || entrada.Longitud == nil {
		escribirError(w, http.StatusBadRequest, "ENTRADA_INVALIDA", "latitud y longitud son obligatorias")
		return
	}
	lat, lng := *entrada.Latitud, *entrada.Longitud
	if math.IsNaN(lat) || math.IsNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		escribirError(w, http.StatusBadRequest, "ENTRADA_INVALIDA", "latitud debe estar en [-90, 90] y longitud en [-180, 180]")
		return
	}

	if h.radios == nil {
		escribirError(w, http.StatusServiceUnavailable, "RADIOS_NO_DISPONIBLES", "el indice de radios no esta cargado")
		return
	}
	codigo, ok := h.radios.Buscar(lat, lng)
	if !ok {
		escribirError(w, http.StatusNotFound, "RADIO_NO_ENCONTRADO", "ningun radio censal contiene el punto")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"codigoRadio": codigo})
}

// esCuerpoDemasiadoGrande detects the sentinel error http.MaxBytesReader produces once the
// configured limit is exceeded. It is not a typed error in the standard library, so this matches
// on Error() the same way the stdlib's own callers do.
func esCuerpoDemasiadoGrande(err error) bool {
	var maxErr *http.MaxBytesError
	return errors.As(err, &maxErr)
}

type errorEnvelope struct {
	Error   string `json:"error"`
	Detalle string `json:"detalle"`
}

func escribirError(w http.ResponseWriter, status int, codigo, detalle string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorEnvelope{Error: codigo, Detalle: detalle})
}
