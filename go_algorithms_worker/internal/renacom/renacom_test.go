package renacom

import (
	"strings"
	"testing"
)

const muestra = `"Identificador","Nombre","Fecha matrícula","Vigencia en meses","Tipo de organización","Fecha de inicio de actividad","Cantidad de asistentes","Cantidad de responsables","Poblacion asistida","Comidas ofrecidas","Fecha de registro","Tipo de georreferenciación","Latitud","Longitud","Municipio","Localidad","Calle","Altura","Entre calle 2","Entre calle 2","Código de provincia","Nombre de provincia","Código de departamento","Nombre de departamento","Código de radio"
2855,"19 de Abril","2022-02-23 16:15:35",4,"Comedor","2010-04-19",100,2,"Niñas y Niños, Adultos","Almuerzo","2020-12-18 15:03:49",3,-34.77332,-58.815248,"","MARCOS PAZ","LOZANO","1502","BERLIN","Monte Agudo","06","Buenos Aires","06525","Marcos Paz","065250609"
9001,"Sin coordenadas","2022-01-01 00:00:00",4,"Merendero","2015-01-01",50,1,"Adultos","Merienda","2020-01-01 00:00:00",7,,,"","CORDOBA","CALLE","1","A","B","14","Córdoba","14014","Capital","140144304"
9002,"Merendero Real","2022-01-01 00:00:00",4,"Merendero","2015-01-01",30,1,"Niñas y Niños","Merienda, Cena","2020-01-01 00:00:00",2,-31.4201,-64.1888,"","CORDOBA","CALLE","2","A","B","14","Córdoba","14014","Capital","140144304"
`

func TestLeerParseaColumnasDuplicadas(t *testing.T) {
	cs, err := Leer(strings.NewReader(muestra))
	if err != nil {
		t.Fatalf("Leer: %v", err)
	}

	// The row with empty coordinates is dropped: it cannot be mapped or scored.
	if len(cs) != 2 {
		t.Fatalf("comedores = %d, want 2", len(cs))
	}

	primero := cs[0]
	if primero.Identificador != 2855 || primero.Nombre != "19 de Abril" {
		t.Errorf("unexpected first row: %+v", primero)
	}
	if primero.Tipo != "Comedor" || primero.Asistentes != 100 {
		t.Errorf("tipo/asistentes = %q/%d", primero.Tipo, primero.Asistentes)
	}
	if primero.CodigoRadio != "065250609" {
		t.Errorf("codigoRadio = %q, want 065250609", primero.CodigoRadio)
	}
	if len(primero.PoblacionAsistida) != 2 {
		t.Errorf("poblacionAsistida = %v, want 2 entries", primero.PoblacionAsistida)
	}
	if len(cs[1].ComidasOfrecidas) != 2 {
		t.Errorf("comidasOfrecidas = %v, want 2 entries", cs[1].ComidasOfrecidas)
	}
}

func TestFiltrarProvincia(t *testing.T) {
	cs, err := Leer(strings.NewReader(muestra))
	if err != nil {
		t.Fatalf("Leer: %v", err)
	}
	cba := FiltrarProvincia(cs, "córdoba")
	if len(cba) != 1 || cba[0].Identificador != 9002 {
		t.Fatalf("FiltrarProvincia = %+v", cba)
	}
}

// Guards the committed dataset: if the published CSV is ever re-downloaded
// with a different shape, this fails instead of silently producing thin data.
func TestCargarDatasetCommiteado(t *testing.T) {
	cs, err := Cargar("../../data/renacom.csv")
	if err != nil {
		t.Fatalf("Cargar: %v", err)
	}
	if len(cs) < 2700 {
		t.Fatalf("comedores = %d, want at least 2700", len(cs))
	}
	for _, c := range cs {
		if c.CodigoRadio == "" {
			t.Fatalf("comedor %d has no census radio code", c.Identificador)
		}
	}
}
