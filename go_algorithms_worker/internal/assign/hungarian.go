// Package assign solves the donation-to-comedor allocation round.
package assign

import "math"

// Unassigned marks a row that received no column in the final matching.
const Unassigned = -1

// Inf is the cost used for pairs that must never be matched. It is large
// enough to dominate any feasible cost but still finite, so the solver's
// potentials stay well defined.
const Inf = math.MaxFloat64 / 4

// Desempate is the secondary cost of one matrix cell. It is compared only
// when two matchings have exactly the same primary cost: Nivel1 first, then
// Nivel2. Both are exact integers, so the comparison never depends on
// floating-point rounding.
type Desempate struct{ Nivel1, Nivel2, Nivel3 int64 }

// costoLex is a (primary, secondary) cost ordered lexicographically. Pairs of
// this kind form an ordered abelian group, so the shortest-augmenting-path
// algorithm stays correct when it works on them instead of on plain floats.
type costoLex struct {
	p          float64
	s1, s2, s3 int64
}

func (a costoLex) menor(b costoLex) bool {
	if a.p != b.p {
		return a.p < b.p
	}
	if a.s1 != b.s1 {
		return a.s1 < b.s1
	}
	if a.s2 != b.s2 {
		return a.s2 < b.s2
	}
	return a.s3 < b.s3
}

func (a costoLex) mas(b costoLex) costoLex {
	return costoLex{a.p + b.p, a.s1 + b.s1, a.s2 + b.s2, a.s3 + b.s3}
}

func (a costoLex) menos(b costoLex) costoLex {
	return costoLex{a.p - b.p, a.s1 - b.s1, a.s2 - b.s2, a.s3 - b.s3}
}

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
// it before calling. Among matchings of equal cost the choice is an artifact
// of column order; use HungarianLex when it must follow a stated rule.
func Hungarian(cost [][]float64) (rowToCol []int, total float64) {
	return HungarianLex(cost, nil)
}

// HungarianLex is Hungarian with a lexicographic secondary criterion (RN-05):
// among all matchings of minimum primary cost it returns one that minimizes
// the summed Nivel1, among those the summed Nivel2, and among those the
// summed Nivel3. desempate is indexed
// like cost; nil means no secondary criterion. The returned total is the
// primary cost only, so scores derived from it are never perturbed.
//
// If two matchings tie on all three sums the result still depends on row and
// column order, so callers that need a total order canonicalize the input
// first (see Ronda).
func HungarianLex(cost [][]float64, desempate [][]Desempate) (rowToCol []int, total float64) {
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
	a := func(i, j int) costoLex {
		c := costoLex{p: cost[i-1][j-1]}
		if desempate != nil {
			d := desempate[i-1][j-1]
			c.s1, c.s2, c.s3 = d.Nivel1, d.Nivel2, d.Nivel3
		}
		return c
	}

	infinito := costoLex{p: math.Inf(1)}

	u := make([]costoLex, n+1) // row potentials
	v := make([]costoLex, m+1) // column potentials
	p := make([]int, m+1)      // p[j] = row currently matched to column j
	way := make([]int, m+1)    // way[j] = predecessor column on the augmenting path

	for i := 1; i <= n; i++ {
		p[0] = i
		j0 := 0

		minv := make([]costoLex, m+1)
		used := make([]bool, m+1)
		for j := range minv {
			minv[j] = infinito
		}

		// Grow a shortest augmenting path from row i until it lands on a free
		// column (p[j0] == 0).
		for {
			used[j0] = true
			i0 := p[j0]
			delta := infinito
			j1 := 0

			for j := 1; j <= m; j++ {
				if used[j] {
					continue
				}
				cur := a(i0, j).menos(u[i0]).menos(v[j])
				if cur.menor(minv[j]) {
					minv[j] = cur
					way[j] = j0
				}
				if minv[j].menor(delta) {
					delta = minv[j]
					j1 = j
				}
			}

			// Re-normalize potentials so the reduced costs stay non-negative.
			for j := 0; j <= m; j++ {
				if used[j] {
					u[p[j]] = u[p[j]].mas(delta)
					v[j] = v[j].menos(delta)
				} else {
					minv[j] = minv[j].menos(delta)
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
