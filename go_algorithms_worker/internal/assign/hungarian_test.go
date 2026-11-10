package assign

import (
	"math"
	"math/rand"
	"testing"
)

// bruteForce enumerates every injective row-to-column mapping. Exponential, so
// it is only usable on tiny matrices — which is exactly what makes it a
// trustworthy oracle for the solver.
func bruteForce(cost [][]float64) float64 {
	n, m := len(cost), len(cost[0])
	usada := make([]bool, m)
	mejor := math.Inf(1)

	var rec func(fila int, acum float64)
	rec = func(fila int, acum float64) {
		if fila == n {
			mejor = math.Min(mejor, acum)
			return
		}
		for j := 0; j < m; j++ {
			if usada[j] {
				continue
			}
			usada[j] = true
			rec(fila+1, acum+cost[fila][j])
			usada[j] = false
		}
	}
	rec(0, 0)
	return mejor
}

func TestHungarianMatchesBruteForce(t *testing.T) {
	rng := rand.New(rand.NewSource(7))

	for caso := 0; caso < 200; caso++ {
		n := 1 + rng.Intn(5)
		m := n + rng.Intn(3)

		cost := make([][]float64, n)
		for i := range cost {
			cost[i] = make([]float64, m)
			for j := range cost[i] {
				cost[i][j] = math.Round(rng.Float64()*200-100) / 10
			}
		}

		_, total := Hungarian(cost)
		esperado := bruteForce(cost)

		if math.Abs(total-esperado) > 1e-9 {
			t.Fatalf("case %d (%dx%d): got %v, brute force %v", caso, n, m, total, esperado)
		}
	}
}

// TestHungarianMatchesBruteForceWithInfCells closes the earlier follow-up from AD-10's review:
// matrizConDescarte's dummy columns are Inf everywhere except their own donation's row, so the
// solver must be correct on matrices containing Inf cells, not just finite ones. It uses the
// package's own Inf sentinel (MaxFloat64/4, not math.Inf) — exactly what matrizConDescarte
// produces — since a real math.Inf would risk Inf-Inf=NaN inside the algorithm's potentials,
// which is not what production code ever actually constructs.
func TestHungarianMatchesBruteForceWithInfCells(t *testing.T) {
	rng := rand.New(rand.NewSource(13))

	for caso := 0; caso < 200; caso++ {
		n := 1 + rng.Intn(5)
		// One dummy column per row, dummy-column style (AD-10's matrizConDescarte): Inf on every
		// other row, a finite "discard cost" on its own row — plus the real candidate columns.
		realCols := rng.Intn(3)
		m := realCols + n

		cost := make([][]float64, n)
		for i := range cost {
			cost[i] = make([]float64, m)
			for j := 0; j < realCols; j++ {
				cost[i][j] = math.Round(rng.Float64()*200-100) / 10
			}
			for j := 0; j < n; j++ {
				if j == i {
					cost[i][realCols+j] = math.Round(rng.Float64()*50) / 10
				} else {
					cost[i][realCols+j] = Inf
				}
			}
		}

		_, total := Hungarian(cost)
		esperado := bruteForce(cost)

		if math.Abs(total-esperado) > 1e-9 {
			t.Fatalf("case %d (%dx%d, %d dummy cols): got %v, brute force %v", caso, n, m, n, total, esperado)
		}
	}
}

func TestHungarianAssignsDistinctColumns(t *testing.T) {
	cost := [][]float64{
		{1, 2, 3},
		{1, 2, 3},
		{1, 2, 3},
	}
	rowToCol, total := Hungarian(cost)

	vistas := map[int]bool{}
	for i, j := range rowToCol {
		if j == Unassigned {
			t.Fatalf("row %d unassigned in a square matrix", i)
		}
		if vistas[j] {
			t.Fatalf("column %d assigned twice", j)
		}
		vistas[j] = true
	}
	if total != 6 {
		t.Fatalf("total = %v, want 6", total)
	}
}

func TestHungarianPanicsWhenColumnsAreScarce(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("expected a panic when columns < rows")
		}
	}()
	Hungarian([][]float64{{1}, {2}})
}
