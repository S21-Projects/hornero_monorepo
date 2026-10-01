// Package api is the worker's HTTP entrypoint (AD-1): POST /v1/ronda runs one allocation round
// over the contrato/assign pipeline, GET /healthz backs the compose healthcheck.
package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"algorithms/internal/assign"
	"algorithms/internal/contrato"
	"algorithms/internal/geo"
)

// maxBodyBytes is AD-14's body-size limit: 1 MiB is generous for 500 donaciones/candidatos and
// small enough that an oversized request cannot pressure the worker's memory.
const maxBodyBytes = 1 << 20

// Handler serves the v1 worker contract. It is built once at startup around the
// geo.Resolvedor loaded from RENACOM (and, optionally, the census CSV) and reused for every
// request — the whole reason the worker is a long-lived process rather than a CLI call per
// ronda (AD-1's rationale).
type Handler struct {
	resolvedor *geo.Resolvedor
}

// NuevoHandler builds a Handler around resolvedor.
func NuevoHandler(resolvedor *geo.Resolvedor) *Handler {
	return &Handler{resolvedor: resolvedor}
}

// Rutas registers the worker's two HTTP endpoints.
func (h *Handler) Rutas() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/ronda", h.ronda)
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
