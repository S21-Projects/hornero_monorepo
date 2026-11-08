package assign

import (
	"reflect"
	"testing"
)

// TestRondaDeterministaMismaEntrada (RNF16): the same input, in the same order, produces an
// identical Resultado on every run. The fixture is the 100x100 city-sized round; map iteration or
// any hidden randomness in the solver would show up as a diff across the repetitions.
func TestRondaDeterministaMismaEntrada(t *testing.T) {
	donaciones, candidatos := fixtureRonda(100, 100, 7)

	base := Ronda(donaciones, candidatos, PesosPorDefecto, ParametrosPorDefecto)
	if len(base.Asignaciones) == 0 {
		t.Fatal("fixture broken: nothing was assigned")
	}
	for run := 1; run <= 50; run++ {
		got := Ronda(donaciones, candidatos, PesosPorDefecto, ParametrosPorDefecto)
		if !reflect.DeepEqual(base, got) {
			t.Fatalf("run %d differs from run 0 for identical input", run)
		}
	}
}
