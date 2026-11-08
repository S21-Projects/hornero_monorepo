package assign

import (
	"math"
	"math/rand"
	"reflect"
	"testing"
)

// iguales builds n candidates that score exactly the same for any donation
// at the same point (same organizacion-level inputs, same coordinates); only
// the tie-break keys differ.
func candidatoEmpatado(necesidadID int64, diasAbierta int) Candidato {
	return Candidato{
		NecesidadID:    necesidadID,
		OrganizacionID: 100 + necesidadID,
		DiasAbierta:    diasAbierta,
		Latitud:        latCentro,
		Longitud:       lngCentro,
		Deficit:        1,
		Urgencia:       0.5,
	}
}

func donacionEmpatada(id int64) Donacion {
	return Donacion{ID: id, Latitud: latCentro, Longitud: lngCentro}
}

// permutaciones calls fn with every ordering of a copy of xs.
func permutaciones[T any](xs []T, fn func([]T)) {
	var rec func(k int)
	cur := append([]T(nil), xs...)
	rec = func(k int) {
		if k == len(cur) {
			fn(append([]T(nil), cur...))
			return
		}
		for i := k; i < len(cur); i++ {
			cur[k], cur[i] = cur[i], cur[k]
			rec(k + 1)
			cur[k], cur[i] = cur[i], cur[k]
		}
	}
	rec(0)
}

func parDe(res Resultado, donacionID int64) (necesidadID int64, ok bool) {
	for _, a := range res.Asignaciones {
		if a.DonacionID == donacionID {
			return a.NecesidadID, true
		}
	}
	return 0, false
}

// RN-05 step 2 and 3: equal score -> the necesidad open longest wins; equal
// age -> the lower id wins. Holds for every input order.
func TestDesempateAntiguedadLuegoID(t *testing.T) {
	candidatos := []Candidato{
		candidatoEmpatado(30, 5),
		candidatoEmpatado(25, 10),
		candidatoEmpatado(20, 10),
	}
	permutaciones(candidatos, func(orden []Candidato) {
		res := Ronda([]Donacion{donacionEmpatada(1)}, orden, PesosPorDefecto, ParametrosPorDefecto)
		got, ok := parDe(res, 1)
		if !ok || got != 20 {
			t.Fatalf("order %v: donation 1 -> %d (assigned=%v), want necesidad 20", idsNecesidad(orden), got, ok)
		}
	})
}

func idsNecesidad(cs []Candidato) []int64 {
	out := make([]int64, len(cs))
	for i, c := range cs {
		out[i] = c.NecesidadID
	}
	return out
}

// RN-05 step 1 dominates: a strictly higher score beats an older necesidad.
func TestDesempateElPuntajeMayorPrevalece(t *testing.T) {
	vieja := candidatoEmpatado(1, 90)
	nueva := candidatoEmpatado(2, 0)
	nueva.Urgencia = 1 // higher score, but opened today
	permutaciones([]Candidato{vieja, nueva}, func(orden []Candidato) {
		res := Ronda([]Donacion{donacionEmpatada(1)}, orden, PesosPorDefecto, ParametrosPorDefecto)
		if got, _ := parDe(res, 1); got != 2 {
			t.Fatalf("order %v: got necesidad %d, want 2 (higher score)", idsNecesidad(orden), got)
		}
	})
}

// Two identical donations competing for one necesidad: the lower donation id
// is matched, the other stays in the pool.
func TestDesempateEntreDonacionesGanaElMenorID(t *testing.T) {
	donaciones := []Donacion{donacionEmpatada(7), donacionEmpatada(3)}
	permutaciones(donaciones, func(orden []Donacion) {
		res := Ronda(orden, []Candidato{candidatoEmpatado(10, 0)}, PesosPorDefecto, ParametrosPorDefecto)
		if got, ok := parDe(res, 3); !ok || got != 10 {
			t.Fatalf("donation 3 must win necesidad 10, got %+v", res.Asignaciones)
		}
		if !reflect.DeepEqual(res.SinAsignar, []int64{7}) {
			t.Fatalf("sinAsignar = %v, want [7]", res.SinAsignar)
		}
	})
}

// Two donations, two necesidades, everything tied: the lower donation id gets
// the necesidad that has been open longest.
func TestDesempateEmparejaMenorIDConLaMasAntigua(t *testing.T) {
	donaciones := []Donacion{donacionEmpatada(1), donacionEmpatada(2)}
	candidatos := []Candidato{candidatoEmpatado(50, 3), candidatoEmpatado(40, 9)}
	permutaciones(donaciones, func(od []Donacion) {
		permutaciones(candidatos, func(oc []Candidato) {
			res := Ronda(od, oc, PesosPorDefecto, ParametrosPorDefecto)
			if got, _ := parDe(res, 1); got != 40 {
				t.Fatalf("donation 1 -> %d, want 40", got)
			}
			if got, _ := parDe(res, 2); got != 50 {
				t.Fatalf("donation 2 -> %d, want 50", got)
			}
		})
	})
}

// Same data in any input order gives the identical Resultado, field by field,
// on instances full of exact ties.
func TestRondaEsDeterministaConEmpatesExactos(t *testing.T) {
	for seed := int64(1); seed <= 40; seed++ {
		rng := rand.New(rand.NewSource(seed))
		n, m := 2+rng.Intn(7), 2+rng.Intn(7)
		donaciones := make([]Donacion, n)
		for i := range donaciones {
			donaciones[i] = Donacion{ID: int64(i + 1), Latitud: latCentro, Longitud: lngCentro, DiasEnFondo: rng.Intn(2) * 10}
		}
		candidatos := make([]Candidato, m)
		for j := range candidatos {
			candidatos[j] = candidatoEmpatado(int64(1000+j), rng.Intn(3)*5)
			if rng.Intn(3) == 0 {
				candidatos[j].Urgencia = 0.9
			}
		}
		base := Ronda(donaciones, candidatos, PesosPorDefecto, ParametrosPorDefecto)
		for k := 0; k < 8; k++ {
			d := append([]Donacion(nil), donaciones...)
			c := append([]Candidato(nil), candidatos...)
			rng.Shuffle(len(d), func(a, b int) { d[a], d[b] = d[b], d[a] })
			rng.Shuffle(len(c), func(a, b int) { c[a], c[b] = c[b], c[a] })
			got := Ronda(d, c, PesosPorDefecto, ParametrosPorDefecto)
			if !reflect.DeepEqual(got, base) {
				t.Fatalf("seed %d shuffle %d: result differs\n got  %+v\n want %+v", seed, k, got, base)
			}
		}
	}
}

// bruteForceLex returns the lexicographically smallest (cost, nivel1, nivel2)
// over every injective row->column assignment.
func bruteForceLex(cost [][]float64, des [][]Desempate) (float64, [3]int64) {
	n, m := len(cost), len(cost[0])
	usada := make([]bool, m)
	mejorCosto := math.Inf(1)
	var mejor [3]int64
	var rec func(fila int, c float64, s [3]int64)
	rec = func(fila int, c float64, s [3]int64) {
		if fila == n {
			if c < mejorCosto || (c == mejorCosto && lexMenor(s, mejor)) {
				mejorCosto, mejor = c, s
			}
			return
		}
		for j := 0; j < m; j++ {
			if usada[j] {
				continue
			}
			usada[j] = true
			d := des[fila][j]
			rec(fila+1, c+cost[fila][j], [3]int64{s[0] + d.Nivel1, s[1] + d.Nivel2, s[2] + d.Nivel3})
			usada[j] = false
		}
	}
	rec(0, 0, [3]int64{})
	return mejorCosto, mejor
}

func lexMenor(a, b [3]int64) bool {
	for k := range a {
		if a[k] != b[k] {
			return a[k] < b[k]
		}
	}
	return false
}

// The solver must return the matching with the smallest secondary cost among
// all matchings of minimum primary cost - the stated rule, not just a stable
// result. Small integer costs make ties frequent.
func TestHungarianLexMinimizaElDesempateEntreOptimos(t *testing.T) {
	rng := rand.New(rand.NewSource(2024))
	for caso := 0; caso < 400; caso++ {
		n := 1 + rng.Intn(5)
		m := n + rng.Intn(3)
		cost := make([][]float64, n)
		des := make([][]Desempate, n)
		for i := range cost {
			cost[i] = make([]float64, m)
			des[i] = make([]Desempate, m)
			for j := range cost[i] {
				cost[i][j] = -float64(rng.Intn(3))
				des[i][j] = Desempate{Nivel1: int64(rng.Intn(5)), Nivel2: int64(rng.Intn(5)), Nivel3: int64(rng.Intn(5))}
			}
		}
		rowToCol, total := HungarianLex(cost, des)
		var got [3]int64
		for i, j := range rowToCol {
			got[0] += des[i][j].Nivel1
			got[1] += des[i][j].Nivel2
			got[2] += des[i][j].Nivel3
		}
		wc, want := bruteForceLex(cost, des)
		if total != wc || got != want {
			t.Fatalf("case %d: got (%v,%v), want (%v,%v)\ncost=%v\ndes=%v", caso, total, got, wc, want, cost, des)
		}
	}
}
