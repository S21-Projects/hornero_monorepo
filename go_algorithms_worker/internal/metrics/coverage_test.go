package metrics

import (
	"math"
	"os"
	"path/filepath"
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

func TestCargarVulnerabilidad(t *testing.T) {
	tests := []struct {
		name    string
		csv     string
		want    map[string]float64
		wantErr bool
	}{
		{
			name: "keeps values, drops empty ones (unknown is never 0)",
			csv: "codigo_radio,habitantes,comedores,necesidades_abiertas,deficit_cobertura,vulnerabilidad\n" +
				"020070204,577,1,0,0.70,0.70\n" +
				"140145415,473,2,3,0.50,1.25\n" +
				"999999999,0,1,0,,\n",
			want: map[string]float64{"020070204": 0.70, "140145415": 1.25},
		},
		{
			name: "ignores unparsable and non-positive values, tolerates a BOM and column order",
			csv:  "\ufeffvulnerabilidad,codigo_radio\nabc,R1\n0,R2\n-1,R3\n2.5,R4\n",
			want: map[string]float64{"R4": 2.5},
		},
		{name: "missing vulnerabilidad column", csv: "codigo_radio,habitantes\nR1,5\n", wantErr: true},
		{name: "missing codigo_radio column", csv: "vulnerabilidad\n1.0\n", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), ArchivoVulnerabilidad)
			if err := os.WriteFile(path, []byte(tt.csv), 0o644); err != nil {
				t.Fatal(err)
			}
			got, err := CargarVulnerabilidad(path)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if len(got) != len(tt.want) {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
			for k, v := range tt.want {
				if got[k] != v {
					t.Errorf("got[%q] = %v, want %v", k, got[k], v)
				}
			}
		})
	}
}

// Guards the committed output of make mapa-datos: if its shape changes, the worker must notice.
func TestCargarVulnerabilidadDatasetCommiteado(t *testing.T) {
	got, err := CargarVulnerabilidad("../../data/" + ArchivoVulnerabilidad)
	if err != nil {
		t.Fatalf("CargarVulnerabilidad: %v", err)
	}
	if len(got) < 1000 {
		t.Fatalf("radios with vulnerabilidad = %d, want at least 1000", len(got))
	}
}
