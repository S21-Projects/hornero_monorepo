package geo

import (
	"os"
	"path/filepath"
	"testing"
)

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

const renacomVulnerabilidad = `"Identificador","Nombre","Tipo de organización","Cantidad de asistentes","Cantidad de responsables","Comidas ofrecidas","Poblacion asistida","Tipo de georreferenciación","Latitud","Longitud","Nombre de provincia","Nombre de departamento","Localidad","Código de radio"
1,"Comedor A","Comedor",100,1,"Almuerzo","Adultos",3,-31.4201,-64.1888,"Córdoba","Capital","CORDOBA","RADIO_A"
2,"Comedor B","Comedor",100,1,"Almuerzo","Adultos",3,-34.6037,-58.3816,"Buenos Aires","CABA","CABA","RADIO_B"
`

// cargarConArchivos writes renacom.csv (and, when non-empty, vulnerabilidad-radios.csv) into one
// temp dir and loads a Resolvedor from it with no census population CSV.
func cargarConArchivos(t *testing.T, vulnerabilidad string) *Resolvedor {
	t.Helper()
	dir := t.TempDir()
	renacomPath := filepath.Join(dir, "renacom.csv")
	if err := os.WriteFile(renacomPath, []byte(renacomVulnerabilidad), 0o644); err != nil {
		t.Fatal(err)
	}
	if vulnerabilidad != "" {
		if err := os.WriteFile(filepath.Join(dir, "vulnerabilidad-radios.csv"), []byte(vulnerabilidad), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	r, err := Cargar(renacomPath, "", "", 1.0)
	if err != nil {
		t.Fatalf("Cargar: %v", err)
	}
	return r
}

// TestCargarUsaVulnerabilidadDelRadio covers the optional vulnerabilidad-radios.csv: its value
// replaces the deficit per radio, an empty value falls through to the next source, and without the
// file the behaviour is the previous one.
func TestCargarUsaVulnerabilidadDelRadio(t *testing.T) {
	const conArchivo = "codigo_radio,habitantes,comedores,necesidades_abiertas,deficit_cobertura,vulnerabilidad\n" +
		"RADIO_A,500,1,2,1.5,4.5\n" +
		"RADIO_B,0,1,0,,\n"

	tests := []struct {
		name           string
		vulnerabilidad string
		lat, lng       float64
		codigoRadio    string
		wantDeficit    float64
		wantFuente     Fuente
	}{
		{
			name:           "RADIO uses vulnerabilidad, not the (zero) population-based deficit",
			vulnerabilidad: conArchivo,
			lat:            -20, lng: -60, codigoRadio: "RADIO_A",
			wantDeficit: 4.5, wantFuente: FuenteRadio,
		},
		{
			name:           "empty vulnerabilidad falls through to NEUTRAL when no precise point is near",
			vulnerabilidad: conArchivo,
			lat:            -34.6037, lng: -58.3816, codigoRadio: "RADIO_B",
			wantDeficit: Neutral, wantFuente: FuenteNeutral,
		},
		{
			name:           "empty vulnerabilidad falls through to CERCANO from a neighbouring radio",
			vulnerabilidad: conArchivo,
			lat:            -31.4202, lng: -64.1888, codigoRadio: "RADIO_B",
			wantDeficit: 4.5, wantFuente: FuenteCercano,
		},
		{
			name:           "CERCANO also reads vulnerabilidad",
			vulnerabilidad: conArchivo,
			lat:            -31.4202, lng: -64.1888, codigoRadio: "",
			wantDeficit: 4.5, wantFuente: FuenteCercano,
		},
		{
			name:           "without the file nothing changes: no population means NEUTRAL",
			vulnerabilidad: "",
			lat:            -20, lng: -60, codigoRadio: "RADIO_A",
			wantDeficit: Neutral, wantFuente: FuenteNeutral,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := cargarConArchivos(t, tt.vulnerabilidad)
			deficit, fuente := r.Resolver(tt.lat, tt.lng, tt.codigoRadio, nil)
			if deficit != tt.wantDeficit || fuente != tt.wantFuente {
				t.Fatalf("Resolver() = (%v, %v), want (%v, %v)", deficit, fuente, tt.wantDeficit, tt.wantFuente)
			}
		})
	}
}

func TestCargarRechazaVulnerabilidadSinColumnas(t *testing.T) {
	dir := t.TempDir()
	renacomPath := filepath.Join(dir, "renacom.csv")
	if err := os.WriteFile(renacomPath, []byte(renacomVulnerabilidad), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "vulnerabilidad-radios.csv"), []byte("codigo_radio,x\nA,1\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Cargar(renacomPath, "", "", 1.0); err == nil {
		t.Fatal("want error for a vulnerabilidad file without the vulnerabilidad column")
	}
}
