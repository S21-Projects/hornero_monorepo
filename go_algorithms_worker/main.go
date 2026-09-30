// Command algorithms is the offline worker for Hornero's geographic metrics
// and donation assignment.
//
//	algorithms metrics [--data f.csv] [--poblacion p.csv] [--provincia Córdoba] [--top 20]
//	algorithms assign  --input ronda.json
//	algorithms serve   [--addr :8090] [--data f.csv] [--poblacion p.csv] [--provincia Córdoba]
//
// metrics and assign are deliberately a batch job, not a service: census radios do not move, so
// coverage is recomputed on a schedule and the MS only ever reads the resulting flat numbers.
// serve is the AD-1 long-lived process the MS calls over HTTP for a ronda: it loads RENACOM once
// at startup (AD-2) instead of on every request.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"algorithms/internal/api"
	"algorithms/internal/assign"
	"algorithms/internal/contrato"
	"algorithms/internal/geo"
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
	case "serve":
		err = cmdServe(os.Args[2:])
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
	fmt.Fprintln(os.Stderr, "  algorithms serve [--addr :8090] [--data f.csv] [--poblacion p.csv] [--provincia P]")
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

// cmdAssign is the offline/batch entrypoint: it reads one contrato.EntradaRondaV1 document and
// prints the matching contrato.SalidaRondaV1, the exact same contract `serve` answers over HTTP
// (AD-1's "batch/offline usage still works" requirement). Deficit resolution (AD-2) uses the same
// --data/--poblacion CSVs `serve` and `metrics` take.
func cmdAssign(args []string) error {
	fs := flag.NewFlagSet("assign", flag.ExitOnError)
	input := fs.String("input", "", "round JSON path ('-' for stdin)")
	data := fs.String("data", "data/renacom.csv", "ReNaCoM CSV path")
	poblacionPath := fs.String("poblacion", "", "census population CSV (codigo_radio,habitantes,hogares)")
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

	var entrada contrato.EntradaRondaV1
	if err := json.NewDecoder(f).Decode(&entrada); err != nil {
		return fmt.Errorf("decoding round: %w", err)
	}
	if err := entrada.Validar(); err != nil {
		return err
	}

	resolvedor, err := geo.Cargar(*data, *poblacionPath, "", 1.0)
	if err != nil {
		return err
	}

	pesos := entrada.ResolverPesos()
	parametros, _ := entrada.ResolverParametros()
	donaciones := entrada.ADonaciones()
	candidatos, meta := entrada.ACandidatos(resolvedor)

	resultado := assign.Ronda(donaciones, candidatos, pesos, parametros)
	salida := contrato.AResultado(resultado, meta, pesos, parametros)

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(salida)
}

// cmdServe runs the AD-1 HTTP entrypoint: POST /v1/ronda and GET /healthz, on a single
// long-lived process so RENACOM (and the optional census CSV) are loaded once, not per request.
func cmdServe(args []string) error {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", ":8090", "listen address")
	data := fs.String("data", "data/renacom.csv", "ReNaCoM CSV path")
	poblacionPath := fs.String("poblacion", "", "census population CSV (codigo_radio,habitantes,hogares)")
	provincia := fs.String("provincia", "", "filter by province name")
	if err := fs.Parse(args); err != nil {
		return err
	}

	if *poblacionPath == "" {
		log.Println("advertencia: sin POBLACION_CSV, todo candidato resolvera deficitFuente=NEUTRAL (AD-2)")
	}

	resolvedor, err := geo.Cargar(*data, *poblacionPath, *provincia, 1.0)
	if err != nil {
		return err
	}

	h := api.NuevoHandler(resolvedor)
	log.Printf("algorithms serve: escuchando en %s", *addr)
	return http.ListenAndServe(*addr, h.Rutas())
}
