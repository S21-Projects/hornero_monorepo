package main

import (
	"testing"

	"algorithms/internal/geo"
)

// serve must start without any CSV: the MS sends the live deficit, and a candidate without one
// resolves to NEUTRAL (spec "Serve starts and assigns without CSVs").
func TestResolvedorServeSinCSV(t *testing.T) {
	resolvedor, err := resolvedorServe("", "", "")
	if err != nil {
		t.Fatalf("serve sin --data no debe fallar: %v", err)
	}

	if d, f := resolvedor.Resolver(-31.41, -64.18, "140140101", nil); d != 1.0 || f != geo.FuenteNeutral {
		t.Errorf("sin deficit provisto: got (%v, %v), want (1, NEUTRAL)", d, f)
	}

	provisto := 2.25
	if d, f := resolvedor.Resolver(-31.41, -64.18, "140140101", &provisto); d != 2.25 || f != geo.FuenteProvisto {
		t.Errorf("con deficit provisto: got (%v, %v), want (2.25, PROVISTO)", d, f)
	}
}
