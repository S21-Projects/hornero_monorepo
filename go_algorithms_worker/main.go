// Command algorithms is the offline worker for Hornero's geographic metrics
// and donation assignment.
//
//	algorithms metrics [--data f.csv] [--poblacion p.csv] [--provincia Córdoba] [--top 20]
//	algorithms assign  --input ronda.json
//
// It is deliberately a batch job, not a service: census radios do not move,
// so coverage is recomputed on a schedule and the MS only ever reads the
// resulting flat numbers.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"algorithms/internal/assign"
	"algorithms/internal/metrics"
	"algorithms/internal/renacom"
)

func main() {
	if len(os.Args) < 2 {
		uso()
		os.Exit(1)
	}

	var err error
	switch os.Args[1] {
	case "metrics":
		err = cmdMetrics(os.Args[2:])
	case "assign":
		err = cmdAssign(os.Args[2:])
	default:
		uso()
		os.Exit(1)
	}

	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func uso() {
	fmt.Fprintln(os.Stderr, "usage:")
	fmt.Fprintln(os.Stderr, "  algorithms metrics [--data f.csv] [--poblacion p.csv] [--provincia P] [--top N] [--json]")
	fmt.Fprintln(os.Stderr, "  algorithms assign --input ronda.json")
}

func cmdMetrics(args []string) error {
	fs := flag.NewFlagSet("metrics", flag.ExitOnError)
	data := fs.String("data", "data/renacom.csv", "ReNaCoM CSV path")
	poblacionPath := fs.String("poblacion", "", "census population CSV (codigo_radio,habitantes,hogares)")
	provincia := fs.String("provincia", "", "filter by province name")
	top := fs.Int("top", 20, "rows to print")
	comoJSON := fs.Bool("json", false, "emit JSON instead of a table")
	if err := fs.Parse(args); err != nil {
		return err
	}

	comedores, err := renacom.Cargar(*data)
	if err != nil {
		return err
	}
	if *provincia != "" {
		comedores = renacom.FiltrarProvincia(comedores, *provincia)
	}

	var poblacion map[string]metrics.Poblacion
	if *poblacionPath != "" {
		if poblacion, err = metrics.CargarPoblacion(*poblacionPath); err != nil {
			return err
		}
	}

	radios := metrics.Agregar(comedores, poblacion)

	if *comoJSON {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(radios)
	}

	fmt.Printf("comedores: %d   radios: %d", len(comedores), len(radios))
	if poblacion == nil {
		fmt.Print("   (sin poblacion: deficit no calculado)")
	}
	fmt.Println()
	fmt.Printf("%-12s %-22s %6s %6s %6s %12s %8s\n",
		"RADIO", "DEPARTAMENTO", "COM", "MER", "ASIST", "HAB/PUNTO", "DEFICIT")

	for i, r := range radios {
		if i >= *top {
			break
		}
		fmt.Printf("%-12s %-22.22s %6d %6d %6d %12.0f %8.2f\n",
			r.CodigoRadio, r.Departamento, r.Comedores, r.Merenderos,
			r.Asistentes, r.HabitantesPorComedor, r.Deficit)
	}
	return nil
}

// entradaRonda is the JSON contract the BFF would post for one allocation run.
type entradaRonda struct {
	Donaciones []assign.Donacion  `json:"donaciones"`
	Candidatos []assign.Candidato `json:"candidatos"`
	Pesos      *assign.Pesos      `json:"pesos,omitempty"`
	Parametros *assign.Parametros `json:"parametros,omitempty"`
}

func cmdAssign(args []string) error {
	fs := flag.NewFlagSet("assign", flag.ExitOnError)
	input := fs.String("input", "", "round JSON path ('-' for stdin)")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *input == "" {
		return fmt.Errorf("--input is required")
	}

	f := os.Stdin
	if *input != "-" {
		var err error
		if f, err = os.Open(*input); err != nil {
			return err
		}
		defer f.Close()
	}

	var entrada entradaRonda
	if err := json.NewDecoder(f).Decode(&entrada); err != nil {
		return fmt.Errorf("decoding round: %w", err)
	}

	pesos := assign.PesosPorDefecto
	if entrada.Pesos != nil {
		pesos = *entrada.Pesos
	}
	parametros := assign.ParametrosPorDefecto
	if entrada.Parametros != nil {
		parametros = *entrada.Parametros
	}

	resultado := assign.Ronda(entrada.Donaciones, entrada.Candidatos, pesos, parametros)

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(resultado)
}
