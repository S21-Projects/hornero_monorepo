// Package assign solves the donation-to-comedor allocation round.
package assign

import "math"

// Unassigned marks a row that received no column in the final matching.
const Unassigned = -1

// Inf is the cost used for pairs that must never be matched. It is large
// enough to dominate any feasible cost but still finite, so the solver's
// potentials stay well defined.
const Inf = math.MaxFloat64 / 4

// Hungarian solves the rectangular linear assignment problem with the
// Jonker-Volgenant shortest-augmenting-path variant of the Kuhn-Munkres
// algorithm, in O(rows^2 * cols) time.
//
// cost[i][j] is the cost of assigning row i to column j. Every row is matched
// to a distinct column, so len(cost) must not exceed the number of columns.
// The returned slice maps each row index to its column index, and the total
// is the summed cost of the matching.
//
// Costs are minimized. Callers holding a "higher is better" score must negate
// it before calling.
func Hungarian(cost [][]float64) (rowToCol []int, total float64) {
	n := len(cost)
	if n == 0 {
		return nil, 0
	}
	m := len(cost[0])
	if m < n {
		panic("assign: Hungarian needs at least as many columns as rows")
	}

	// The classic formulation is 1-indexed with a sentinel at index 0, so the
	// internal arrays carry one extra slot and a() shifts into the caller's
	// 0-indexed matrix.
	a := func(i, j int) float64 { return cost[i-1][j-1] }

	u := make([]float64, n+1) // row potentials
	v := make([]float64, m+1) // column potentials
	p := make([]int, m+1)     // p[j] = row currently matched to column j
	way := make([]int, m+1)   // way[j] = predecessor column on the augmenting path

	for i := 1; i <= n; i++ {
		p[0] = i
		j0 := 0

		minv := make([]float64, m+1)
		used := make([]bool, m+1)
		for j := range minv {
			minv[j] = math.Inf(1)
		}

		// Grow a shortest augmenting path from row i until it lands on a free
		// column (p[j0] == 0).
		for {
			used[j0] = true
			i0 := p[j0]
			delta := math.Inf(1)
			j1 := 0

			for j := 1; j <= m; j++ {
				if used[j] {
					continue
				}
				cur := a(i0, j) - u[i0] - v[j]
				if cur < minv[j] {
					minv[j] = cur
					way[j] = j0
				}
				if minv[j] < delta {
					delta = minv[j]
					j1 = j
				}
			}

			// Re-normalize potentials so the reduced costs stay non-negative.
			for j := 0; j <= m; j++ {
				if used[j] {
					u[p[j]] += delta
					v[j] -= delta
				} else {
					minv[j] -= delta
				}
			}

			j0 = j1
			if p[j0] == 0 {
				break
			}
		}

		// Walk the path backwards, flipping matched and unmatched edges.
		for j0 != 0 {
			j1 := way[j0]
			p[j0] = p[j1]
			j0 = j1
		}
	}

	rowToCol = make([]int, n)
	for i := range rowToCol {
		rowToCol[i] = Unassigned
	}
	for j := 1; j <= m; j++ {
		if p[j] > 0 {
			rowToCol[p[j]-1] = j - 1
		}
	}

	for i, j := range rowToCol {
		if j != Unassigned {
			total += cost[i][j]
		}
	}
	return rowToCol, total
}
