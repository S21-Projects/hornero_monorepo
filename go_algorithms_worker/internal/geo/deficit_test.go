package geo

import "testing"

// Reuse Córdoba-ish coordinates so the fixtures read the same way as internal/assign's tests.
const (
	latCentro = -31.4201
	lngCentro = -64.1888
)

func resolvedorDePrueba() *Resolvedor {
	porRadio := map[string]float64{
		"RADIO_CON_DEFICIT": 2.0,
		"RADIO_SIN_DEFICIT": 0.0,
	}
	puntos := []Punto{
		{Latitud: latCentro, Longitud: lngCentro, CodigoRadio: "RADIO_CON_DEFICIT"},
	}
	return NuevoResolvedor(porRadio, puntos, 1.0)
}

// TestResolverPrecedencia covers the AD-2 4-row precedence table: PROVISTO > RADIO > CERCANO >
// NEUTRAL.
func TestResolverPrecedencia(t *testing.T) {
	r := resolvedorDePrueba()
	provisto := 5.0

	tests := []struct {
		name        string
		lat, lng    float64
		codigoRadio string
		provisto    *float64
		wantDeficit float64
		wantFuente  Fuente
	}{
		{
			name: "PROVISTO wins over everything else, even a known radio",
			lat:  latCentro, lng: lngCentro, codigoRadio: "RADIO_CON_DEFICIT", provisto: &provisto,
			wantDeficit: 5.0, wantFuente: FuenteProvisto,
		},
		{
			name: "RADIO used when known directly and its deficit is positive",
			lat:  latCentro + 10, lng: lngCentro + 10, codigoRadio: "RADIO_CON_DEFICIT", provisto: nil,
			wantDeficit: 2.0, wantFuente: FuenteRadio,
		},
		{
			name: "a known radio with zero deficit does not satisfy RADIO, falls through to CERCANO",
			lat:  latCentro, lng: lngCentro, codigoRadio: "RADIO_SIN_DEFICIT", provisto: nil,
			wantDeficit: 2.0, wantFuente: FuenteCercano,
		},
		{
			name: "CERCANO resolves from the nearest precise point when no codigoRadio is given",
			lat:  latCentro + 0.001, lng: lngCentro, codigoRadio: "", provisto: nil,
			wantDeficit: 2.0, wantFuente: FuenteCercano,
		},
		{
			name: "NEUTRAL when nothing else applies",
			lat:  -33.0, lng: -70.0, codigoRadio: "", provisto: nil,
			wantDeficit: Neutral, wantFuente: FuenteNeutral,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deficit, fuente := r.Resolver(tt.lat, tt.lng, tt.codigoRadio, tt.provisto)
			if deficit != tt.wantDeficit || fuente != tt.wantFuente {
				t.Fatalf("Resolver() = (%v, %v), want (%v, %v)", deficit, fuente, tt.wantDeficit, tt.wantFuente)
			}
		})
	}
}

// TestResolverSinPoblacionTodoEsNeutral is AD-2's documented known limitation: until the INDEC
// population CSV exists, every radio's deficit is zero, so every candidate resolves to NEUTRAL
// regardless of proximity or codigoRadio.
func TestResolverSinPoblacionTodoEsNeutral(t *testing.T) {
	porRadio := map[string]float64{"R1": 0.0, "R2": 0.0}
	puntos := []Punto{{Latitud: latCentro, Longitud: lngCentro, CodigoRadio: "R1"}}
	r := NuevoResolvedor(porRadio, puntos, 1.0)

	deficit, fuente := r.Resolver(latCentro, lngCentro, "R1", nil)
	if deficit != Neutral || fuente != FuenteNeutral {
		t.Fatalf("Resolver() = (%v, %v), want (%v, %v) when every radio has zero deficit",
			deficit, fuente, Neutral, FuenteNeutral)
	}
}

// TestNuevoResolvedorDefaultRadio confirms the documented 1.0 km default kicks in for a
// non-positive radioResolucionKm.
func TestNuevoResolvedorDefaultRadio(t *testing.T) {
	porRadio := map[string]float64{"R1": 3.0}
	puntos := []Punto{{Latitud: latCentro, Longitud: lngCentro, CodigoRadio: "R1"}}
	r := NuevoResolvedor(porRadio, puntos, 0)

	deficit, fuente := r.Resolver(latCentro+0.001, lngCentro, "", nil)
	if deficit != 3.0 || fuente != FuenteCercano {
		t.Fatalf("Resolver() = (%v, %v), want CERCANO with the default 1.0km radius", deficit, fuente)
	}
}
