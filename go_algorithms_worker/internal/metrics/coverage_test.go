package metrics

import (
	"math"
	"testing"

	"algorithms/internal/renacom"
)

func comedor(radio, tipo string, asistentes int) renacom.Comedor {
	return renacom.Comedor{CodigoRadio: radio, Tipo: tipo, Asistentes: asistentes, Provincia: "Córdoba"}
}

func TestAgregarCuentaPorRadio(t *testing.T) {
	radios := Agregar([]renacom.Comedor{
		comedor("140144304", "Comedor", 100),
		comedor("140144304", "Merendero", 50),
		comedor("140147616", "Comedor", 20),
		comedor("", "Comedor", 999), // no radio code: not aggregatable
	}, nil)

	if len(radios) != 2 {
		t.Fatalf("radios = %d, want 2", len(radios))
	}

	porCodigo := map[string]Radio{}
	for _, r := range radios {
		porCodigo[r.CodigoRadio] = r
	}

	r := porCodigo["140144304"]
	if r.Comedores != 1 || r.Merenderos != 1 || r.Asistentes != 150 || r.Total() != 2 {
		t.Errorf("unexpected aggregation: %+v", r)
	}
	if r.Deficit != 0 {
		t.Errorf("deficit = %v, want 0 without census population", r.Deficit)
	}
}

func TestAgregarCalculaDeficitContraLaMediana(t *testing.T) {
	// Three radios, one comedor each, populations 1000 / 2000 / 4000.
	// Median coverage is 2000 habitantes per comedor.
	poblacion := map[string]Poblacion{
		"A": {CodigoRadio: "A", Habitantes: 1000},
		"B": {CodigoRadio: "B", Habitantes: 2000},
		"C": {CodigoRadio: "C", Habitantes: 4000},
	}
	radios := Agregar([]renacom.Comedor{
		comedor("A", "Comedor", 0),
		comedor("B", "Comedor", 0),
		comedor("C", "Comedor", 0),
	}, poblacion)

	esperado := map[string]float64{"A": 0.5, "B": 1, "C": 2}
	for _, r := range radios {
		if math.Abs(r.Deficit-esperado[r.CodigoRadio]) > 1e-9 {
			t.Errorf("radio %s deficit = %v, want %v", r.CodigoRadio, r.Deficit, esperado[r.CodigoRadio])
		}
	}

	// Sorted most underserved first, which is the order the map legend and the
	// assignment scoring both read.
	if radios[0].CodigoRadio != "C" {
		t.Errorf("first radio = %s, want C", radios[0].CodigoRadio)
	}
}
