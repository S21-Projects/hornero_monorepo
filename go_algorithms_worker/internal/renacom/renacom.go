// Package renacom loads the ReNaCoM open dataset (comedores y merenderos
// comunitarios), published by CONICET.
//
// Source: https://ri.conicet.gov.ar/handle/11336/278030
// The local copy lives in data/renacom.csv.
package renacom

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Comedor is one row of the dataset, narrowed to the columns the metrics and
// the assignment algorithm actually use.
type Comedor struct {
	Identificador     int64
	Nombre            string
	Tipo              string // "Comedor" or "Merendero"
	Asistentes        int
	Responsables      int
	ComidasOfrecidas  []string
	PoblacionAsistida []string
	Latitud           float64
	Longitud          float64
	// Georreferenciacion is the precision level of the coordinates, per the
	// published data dictionary:
	//
	//	1  georeferenced by RENACOM itself
	//	2  precise, Google Maps
	//	3  precise, manual
	//	4  street intersection, Google Maps (somewhere on the block)
	//	5  street intersection, manual (somewhere on the block)
	//	6  within 300 metres
	//	7  could not be located at all
	//	9  never processed manually
	//
	// Levels 1-5 are block-accurate or better. Levels 6 and 7 are too coarse
	// to attribute to a census radio with confidence — see PrecisionDudosa.
	Georreferenciacion int
	Provincia          string
	Departamento       string
	Localidad          string
	// CodigoRadio is the 9-digit INDEC census radio code (PP DDD FF RR:
	// province, department, fraction, radio), the join key to census population.
	// The declared code is not Censo 2022 vintage; when data/renacom-radio-2022.csv
	// exists (make mapa-datos) Cargar replaces it with the point-in-polygon radio.
	CodigoRadio string
}

// bom is the UTF-8 byte order mark some exports prepend to the first header.
const bom = "\ufeff"

// Columnas maps each struct field to its Spanish header in the published CSV.
var columnas = []string{
	"Identificador", "Nombre", "Tipo de organización", "Cantidad de asistentes",
	"Cantidad de responsables", "Comidas ofrecidas", "Poblacion asistida",
	"Latitud", "Longitud", "Tipo de georreferenciación", "Nombre de provincia",
	"Nombre de departamento", "Localidad", "Código de radio",
}

// Cargar reads the ReNaCoM CSV at path.
func Cargar(path string) ([]Comedor, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("renacom: %w", err)
	}
	defer f.Close()
	cs, err := Leer(f)
	if err != nil {
		return nil, err
	}

	// Optional sibling override with the Censo 2022 radio per Identificador.
	override := filepath.Join(filepath.Dir(path), ArchivoRadio2022)
	if _, err := os.Stat(override); err == nil {
		if err := AplicarRadio2022(cs, override); err != nil {
			return nil, err
		}
	}
	return cs, nil
}

// ArchivoRadio2022 is the file name, next to renacom.csv, that maps each
// Identificador to its Censo 2022 radio (columns identificador,codigo_radio_2022).
const ArchivoRadio2022 = "renacom-radio-2022.csv"

// AplicarRadio2022 overwrites CodigoRadio, matching by Identificador, with the
// codes in the CSV at path. Comedores absent from the file keep their declared code.
func AplicarRadio2022(cs []Comedor, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("renacom: %w", err)
	}
	defer f.Close()

	cr := csv.NewReader(f)
	cr.FieldsPerRecord = -1
	header, err := cr.Read()
	if err != nil {
		return fmt.Errorf("renacom: reading %s header: %w", path, err)
	}
	colID, colRadio := -1, -1
	for i, h := range header {
		switch strings.ToLower(strings.TrimSpace(strings.TrimPrefix(h, bom))) {
		case "identificador":
			colID = i
		case "codigo_radio_2022":
			colRadio = i
		}
	}
	if colID < 0 || colRadio < 0 {
		return fmt.Errorf("renacom: %s needs columns identificador,codigo_radio_2022", path)
	}

	radios := make(map[int64]string)
	for {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("renacom: %s: %w", path, err)
		}
		if colID >= len(rec) || colRadio >= len(rec) {
			continue
		}
		id, err := strconv.ParseInt(strings.TrimSpace(rec[colID]), 10, 64)
		if err != nil {
			continue
		}
		if codigo := strings.TrimSpace(rec[colRadio]); codigo != "" {
			radios[id] = codigo
		}
	}

	for i := range cs {
		if codigo, ok := radios[cs[i].Identificador]; ok {
			cs[i].CodigoRadio = codigo
		}
	}
	return nil
}

// Leer parses the ReNaCoM CSV from r.
//
// The published file has two columns both literally named "Entre calle 2", so
// headers are resolved by first occurrence and the duplicate is ignored.
func Leer(r io.Reader) ([]Comedor, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1

	header, err := cr.Read()
	if err != nil {
		return nil, fmt.Errorf("renacom: reading header: %w", err)
	}

	idx := make(map[string]int, len(header))
	for i, h := range header {
		h = strings.TrimSpace(strings.TrimPrefix(h, bom))
		if _, dup := idx[h]; !dup {
			idx[h] = i
		}
	}
	for _, c := range columnas {
		if _, ok := idx[c]; !ok {
			return nil, fmt.Errorf("renacom: missing column %q", c)
		}
	}

	get := func(rec []string, col string) string {
		i := idx[col]
		if i >= len(rec) {
			return ""
		}
		return strings.TrimSpace(rec[i])
	}

	var out []Comedor
	for linea := 2; ; linea++ {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("renacom: line %d: %w", linea, err)
		}

		lat, errLat := strconv.ParseFloat(get(rec, "Latitud"), 64)
		lng, errLng := strconv.ParseFloat(get(rec, "Longitud"), 64)
		if errLat != nil || errLng != nil {
			// A row without usable coordinates cannot be mapped or scored.
			continue
		}

		id, _ := strconv.ParseInt(get(rec, "Identificador"), 10, 64)
		asistentes, _ := strconv.Atoi(get(rec, "Cantidad de asistentes"))
		responsables, _ := strconv.Atoi(get(rec, "Cantidad de responsables"))
		geo, _ := strconv.Atoi(get(rec, "Tipo de georreferenciación"))

		out = append(out, Comedor{
			Identificador:      id,
			Nombre:             get(rec, "Nombre"),
			Tipo:               get(rec, "Tipo de organización"),
			Asistentes:         asistentes,
			Responsables:       responsables,
			ComidasOfrecidas:   separar(get(rec, "Comidas ofrecidas")),
			PoblacionAsistida:  separar(get(rec, "Poblacion asistida")),
			Latitud:            lat,
			Longitud:           lng,
			Georreferenciacion: geo,
			Provincia:          get(rec, "Nombre de provincia"),
			Departamento:       get(rec, "Nombre de departamento"),
			Localidad:          get(rec, "Localidad"),
			CodigoRadio:        get(rec, "Código de radio"),
		})
	}
	return out, nil
}

func separar(s string) []string {
	if s == "" {
		return nil
	}
	partes := strings.Split(s, ",")
	out := make([]string, 0, len(partes))
	for _, p := range partes {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// PrecisionDudosa reports whether the coordinates are too coarse to trust for
// per-radio aggregation: level 6 is only accurate to 300 metres, level 7 was
// never located, and level 9 was never processed. In the committed dataset
// that is 193 of 2730 rows nationally (191 at level 6, 2 at level 7, none at
// level 9), and 8 of 264 in Córdoba.
func (c Comedor) PrecisionDudosa() bool {
	return c.Georreferenciacion >= 6
}

// FiltrarProvincia keeps only the comedores of one province.
func FiltrarProvincia(cs []Comedor, provincia string) []Comedor {
	var out []Comedor
	for _, c := range cs {
		if strings.EqualFold(c.Provincia, provincia) {
			out = append(out, c)
		}
	}
	return out
}
