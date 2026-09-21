// Package metrics turns the ReNaCoM point dataset into per-radio coverage
// figures, the denominator the assignment algorithm scores against.
package metrics

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"

	"algorithms/internal/renacom"
)

// Poblacion is the census population of one INDEC radio. It is the piece the
// ReNaCoM dataset does not carry and that must come from INDEC (Censo 2022).
type Poblacion struct {
	CodigoRadio string
	Habitantes  int
	Hogares     int
}

// Radio aggregates every comedor sitting in one census radio.
type Radio struct {
	CodigoRadio  string `json:"codigoRadio"`
	Provincia    string `json:"provincia"`
	Departamento string `json:"departamento"`

	Comedores  int `json:"comedores"`
	Merenderos int `json:"merenderos"`
	Asistentes int `json:"asistentes"`

	// Habitantes is 0 when no census population was supplied for this radio.
	Habitantes int `json:"habitantes"`
	Hogares    int `json:"hogares"`

	// HabitantesPorComedor is the raw coverage figure: how many people each
	// comedor in this radio has to serve. Zero when population is unknown.
	HabitantesPorComedor float64 `json:"habitantesPorComedor"`

	// Deficit is HabitantesPorComedor over the median across all radios with
	// known population. 1.0 is typical, 2.0 is twice as underserved. This is
	// the number the scoring weights consume, and it is deliberately a ratio
	// so it stays comparable between cities of different sizes.
	Deficit float64 `json:"deficit"`
}

// Total is the number of food-assistance points in the radio.
func (r Radio) Total() int { return r.Comedores + r.Merenderos }

// Agregar groups comedores by census radio and, when population is supplied,
// computes the coverage deficit of each radio against the median.
//
// Passing a nil population map still produces useful counts — it just leaves
// Deficit at zero, which makes every radio score the same on that term.
func Agregar(cs []renacom.Comedor, poblacion map[string]Poblacion) []Radio {
	porRadio := make(map[string]*Radio)

	for _, c := range cs {
		if c.CodigoRadio == "" {
			continue
		}
		r, ok := porRadio[c.CodigoRadio]
		if !ok {
			r = &Radio{
				CodigoRadio:  c.CodigoRadio,
				Provincia:    c.Provincia,
				Departamento: c.Departamento,
			}
			porRadio[c.CodigoRadio] = r
		}
		if strings.EqualFold(c.Tipo, "Merendero") {
			r.Merenderos++
		} else {
			r.Comedores++
		}
		r.Asistentes += c.Asistentes
	}

	radios := make([]Radio, 0, len(porRadio))
	for _, r := range porRadio {
		if p, ok := poblacion[r.CodigoRadio]; ok {
			r.Habitantes = p.Habitantes
			r.Hogares = p.Hogares
			if total := r.Total(); total > 0 && p.Habitantes > 0 {
				r.HabitantesPorComedor = float64(p.Habitantes) / float64(total)
			}
		}
		radios = append(radios, *r)
	}

	if mediana := medianaCobertura(radios); mediana > 0 {
		for i := range radios {
			if radios[i].HabitantesPorComedor > 0 {
				radios[i].Deficit = radios[i].HabitantesPorComedor / mediana
			}
		}
	}

	sort.Slice(radios, func(a, b int) bool {
		if radios[a].Deficit != radios[b].Deficit {
			return radios[a].Deficit > radios[b].Deficit
		}
		return radios[a].CodigoRadio < radios[b].CodigoRadio
	})
	return radios
}

func medianaCobertura(radios []Radio) float64 {
	var vals []float64
	for _, r := range radios {
		if r.HabitantesPorComedor > 0 {
			vals = append(vals, r.HabitantesPorComedor)
		}
	}
	if len(vals) == 0 {
		return 0
	}
	sort.Float64s(vals)
	mid := len(vals) / 2
	if len(vals)%2 == 1 {
		return vals[mid]
	}
	return (vals[mid-1] + vals[mid]) / 2
}

// CargarPoblacion reads a census population CSV keyed by radio code. Expected
// headers: codigo_radio, habitantes, hogares (hogares optional).
func CargarPoblacion(path string) (map[string]Poblacion, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("metrics: %w", err)
	}
	defer f.Close()

	cr := csv.NewReader(f)
	cr.FieldsPerRecord = -1

	header, err := cr.Read()
	if err != nil {
		return nil, fmt.Errorf("metrics: reading header: %w", err)
	}
	idx := make(map[string]int, len(header))
	for i, h := range header {
		idx[strings.ToLower(strings.TrimSpace(h))] = i
	}
	colRadio, ok := idx["codigo_radio"]
	if !ok {
		return nil, fmt.Errorf("metrics: missing column codigo_radio")
	}
	colHab, ok := idx["habitantes"]
	if !ok {
		return nil, fmt.Errorf("metrics: missing column habitantes")
	}
	colHog, tieneHogares := idx["hogares"]

	out := make(map[string]Poblacion)
	for {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("metrics: %w", err)
		}
		codigo := strings.TrimSpace(rec[colRadio])
		if codigo == "" {
			continue
		}
		hab, _ := strconv.Atoi(strings.TrimSpace(rec[colHab]))
		hog := 0
		if tieneHogares && colHog < len(rec) {
			hog, _ = strconv.Atoi(strings.TrimSpace(rec[colHog]))
		}
		out[codigo] = Poblacion{CodigoRadio: codigo, Habitantes: hab, Hogares: hog}
	}
	return out, nil
}
