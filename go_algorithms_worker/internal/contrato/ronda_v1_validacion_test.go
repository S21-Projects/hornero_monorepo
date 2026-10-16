package contrato

import (
	"testing"

	"algorithms/internal/assign"
)

func ptrF(v float64) *float64 { return &v }
func ptrI(v int) *int         { return &v }

// Numeric overrides and per-item values that would turn a score into NaN/Inf or a negative term
// are rejected at the wire boundary instead of reaching the cost matrix.
func TestValidarRechazaValoresNumericosQueRompenElScore(t *testing.T) {
	casos := map[string]func(e *EntradaRondaV1){
		"distanciaMediaKm 0":         func(e *EntradaRondaV1) { e.Parametros = &ParametrosV1{DistanciaMediaKm: ptrF(0)} },
		"distanciaMaximaKm negativa": func(e *EntradaRondaV1) { e.Parametros = &ParametrosV1{DistanciaMaximaKm: ptrF(-1)} },
		"esperaMaximaDias 0":         func(e *EntradaRondaV1) { e.Parametros = &ParametrosV1{EsperaMaximaDias: ptrI(0)} },
		"deficitMaximo 0":            func(e *EntradaRondaV1) { e.Parametros = &ParametrosV1{DeficitMaximo: ptrF(0)} },
		"penalizacion negativa":      func(e *EntradaRondaV1) { e.Parametros = &ParametrosV1{PenalizacionNoAsignar: ptrF(-0.1)} },
		"pseudoObs 0":                func(e *EntradaRondaV1) { e.Parametros = &ParametrosV1{CumplimientoPseudoObs: ptrF(0)} },
		"prior fuera de [0,1]":       func(e *EntradaRondaV1) { e.Parametros = &ParametrosV1{CumplimientoPrior: ptrF(1.5)} },
		"radioResolucion negativo":   func(e *EntradaRondaV1) { e.Parametros = &ParametrosV1{RadioResolucionKm: ptrF(-1)} },
		"peso negativo": func(e *EntradaRondaV1) {
			e.Pesos = &assign.Pesos{Deficit: -0.1, Urgencia: 1}
		},
		"pesos todos en 0":        func(e *EntradaRondaV1) { e.Pesos = &assign.Pesos{} },
		"urgencia fuera de [0,1]": func(e *EntradaRondaV1) { e.Candidatos[0].Urgencia = 2 },
		"deficit negativo":        func(e *EntradaRondaV1) { e.Candidatos[0].Deficit = ptrF(-1) },
		"dias sin donacion negativos": func(e *EntradaRondaV1) {
			e.Candidatos[0].DiasDesdeUltimaDonacion = -1
		},
		"cumplimiento negativo": func(e *EntradaRondaV1) {
			e.Candidatos[0].Cumplimiento = &CumplimientoV1{Entregadas: -1}
		},
		"dias en fondo negativos": func(e *EntradaRondaV1) { e.Donaciones[0].DiasEnFondo = -1 },
		"necesidad duplicada": func(e *EntradaRondaV1) {
			e.Candidatos = append(e.Candidatos, e.Candidatos[0])
		},
		"donacion duplicada": func(e *EntradaRondaV1) {
			e.Donaciones = append(e.Donaciones, e.Donaciones[0])
		},
	}
	for nombre, romper := range casos {
		t.Run(nombre, func(t *testing.T) {
			e := entradaValida()
			romper(&e)
			err := e.Validar()
			if err == nil {
				t.Fatal("Validar() = nil, want ENTRADA_INVALIDA")
			}
			if got := codigoDe(t, err); got != "ENTRADA_INVALIDA" {
				t.Fatalf("codigo = %q, want ENTRADA_INVALIDA", got)
			}
		})
	}
}

// Valid boundary values keep passing: 0 distanciaMaximaKm disables the cut-off, a zero penalty
// reproduces the original ronda, a weight may be 0 as long as one is positive.
func TestValidarAceptaValoresLimiteValidos(t *testing.T) {
	e := entradaValida()
	e.Parametros = &ParametrosV1{
		DistanciaMaximaKm:     ptrF(0),
		PenalizacionNoAsignar: ptrF(0),
		CumplimientoPrior:     ptrF(1),
	}
	e.Pesos = &assign.Pesos{Urgencia: 1}
	e.Candidatos[0].Deficit = ptrF(0)
	if err := e.Validar(); err != nil {
		t.Fatalf("Validar() = %v, want nil", err)
	}
}
