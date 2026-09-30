package contrato

import (
	"errors"
	"math"
	"testing"
)

func entradaValida() EntradaRondaV1 {
	return EntradaRondaV1{
		Version: 1,
		Donaciones: []DonacionV1{
			{ID: 1, Latitud: -31.41, Longitud: -64.18, Categoria: "NO_PERECEDERO"},
		},
		Candidatos: []CandidatoV1{
			{NecesidadID: 10, OrganizacionID: 100, Latitud: -31.40, Longitud: -64.20, Urgencia: 0.5},
		},
	}
}

func codigoDe(t *testing.T, err error) string {
	t.Helper()
	var ec *ErrorContrato
	if !errors.As(err, &ec) {
		t.Fatalf("err = %v (%T), want *ErrorContrato", err, err)
	}
	return ec.Codigo
}

func TestValidarEntradaValidaNoFalla(t *testing.T) {
	if err := entradaValida().Validar(); err != nil {
		t.Fatalf("valid input rejected: %v", err)
	}
}

func TestValidarVersionNoSoportada(t *testing.T) {
	e := entradaValida()
	e.Version = 2
	if got := codigoDe(t, e.Validar()); got != "VERSION_NO_SOPORTADA" {
		t.Fatalf("codigo = %q, want VERSION_NO_SOPORTADA", got)
	}
}

func TestValidarVersionCero(t *testing.T) {
	e := entradaValida()
	e.Version = 0
	if got := codigoDe(t, e.Validar()); got != "VERSION_NO_SOPORTADA" {
		t.Fatalf("codigo = %q, want VERSION_NO_SOPORTADA", got)
	}
}

func TestValidarLimiteDonaciones(t *testing.T) {
	e := entradaValida()
	for i := 0; i < 500; i++ {
		e.Donaciones = append(e.Donaciones, DonacionV1{ID: int64(i + 100), Latitud: -31.4, Longitud: -64.2})
	}
	if got := codigoDe(t, e.Validar()); got != "ENTRADA_INVALIDA" {
		t.Fatalf("codigo = %q, want ENTRADA_INVALIDA for 501 donaciones", got)
	}
}

func TestValidarLimiteCandidatos(t *testing.T) {
	e := entradaValida()
	for i := 0; i < 500; i++ {
		e.Candidatos = append(e.Candidatos, CandidatoV1{NecesidadID: int64(i + 1000), OrganizacionID: int64(i + 2000), Latitud: -31.4, Longitud: -64.2})
	}
	if got := codigoDe(t, e.Validar()); got != "ENTRADA_INVALIDA" {
		t.Fatalf("codigo = %q, want ENTRADA_INVALIDA for 501 candidatos", got)
	}
}

func TestValidarLimiteExacto500NoFalla(t *testing.T) {
	e := entradaValida()
	for i := 0; i < 499; i++ {
		e.Donaciones = append(e.Donaciones, DonacionV1{ID: int64(i + 100), Latitud: -31.4, Longitud: -64.2})
		e.Candidatos = append(e.Candidatos, CandidatoV1{NecesidadID: int64(i + 1000), OrganizacionID: int64(i + 2000), Latitud: -31.4, Longitud: -64.2})
	}
	if err := e.Validar(); err != nil {
		t.Fatalf("500 donaciones/candidatos exactly must be accepted, got: %v", err)
	}
}

func TestValidarCoordenadasFinitasYEnRango(t *testing.T) {
	tests := []struct {
		name string
		mut  func(*EntradaRondaV1)
	}{
		{"donacion latitud fuera de rango", func(e *EntradaRondaV1) { e.Donaciones[0].Latitud = 200 }},
		{"donacion longitud fuera de rango", func(e *EntradaRondaV1) { e.Donaciones[0].Longitud = -200 }},
		{"donacion latitud NaN", func(e *EntradaRondaV1) { e.Donaciones[0].Latitud = math.NaN() }},
		{"candidato longitud infinita", func(e *EntradaRondaV1) { e.Candidatos[0].Longitud = math.Inf(1) }},
		{"candidato latitud infinita negativa", func(e *EntradaRondaV1) { e.Candidatos[0].Latitud = math.Inf(-1) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := entradaValida()
			tt.mut(&e)
			if got := codigoDe(t, e.Validar()); got != "ENTRADA_INVALIDA" {
				t.Fatalf("codigo = %q, want ENTRADA_INVALIDA", got)
			}
		})
	}
}

// TestValidarCategoriaDesconocidaPasaSinCambios: AD-14 — categoria is a free-text pass-through,
// not a closed enum the worker validates. A future category the worker has never heard of must
// not be rejected.
func TestValidarCategoriaDesconocidaPasaSinCambios(t *testing.T) {
	e := entradaValida()
	e.Donaciones[0].Categoria = "UNA_CATEGORIA_QUE_NO_EXISTE_TODAVIA"
	if err := e.Validar(); err != nil {
		t.Fatalf("unknown categoria must pass through untouched, got err: %v", err)
	}
}

// TestADonacionesMapeaCampos: 5a.7 — wire DTOs map onto the unchanged assign.Donacion, including
// the AD-10/AD-3 fields a producer may not have set yet.
func TestADonacionesMapeaCampos(t *testing.T) {
	e := entradaValida()
	e.Donaciones[0].DiasEnFondo = 12
	e.Donaciones[0].OrganizacionesExcluidas = []int64{5}

	out := e.ADonaciones()
	if len(out) != 1 {
		t.Fatalf("len = %d, want 1", len(out))
	}
	got := out[0]
	if got.ID != 1 || got.DiasEnFondo != 12 || len(got.OrganizacionesExcluidas) != 1 || got.OrganizacionesExcluidas[0] != 5 {
		t.Fatalf("mapped donacion = %+v", got)
	}
}
