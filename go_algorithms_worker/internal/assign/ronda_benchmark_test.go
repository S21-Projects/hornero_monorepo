package assign

import (
	"math/rand"
	"testing"
)

// fixtureRonda builds a reproducible, city-sized round: donations and necesidades scattered over
// roughly 20 km around the centre, a mix of categories, varied deficit/urgency/wait values, and
// a few organizaciones excluded per donation. Same seed, same fixture.
func fixtureRonda(n, m int, seed int64) ([]Donacion, []Candidato) {
	rng := rand.New(rand.NewSource(seed))
	categorias := []string{"ALIMENTO_SECO", "ALIMENTO_FRESCO", "ROPA", "HIGIENE"}
	orgs := m / 2 // two necesidades per organizacion on average

	donaciones := make([]Donacion, n)
	for i := range donaciones {
		d := Donacion{
			ID:          int64(i + 1),
			Latitud:     latCentro + (rng.Float64()-0.5)*0.36,
			Longitud:    lngCentro + (rng.Float64()-0.5)*0.36,
			Categoria:   categorias[rng.Intn(len(categorias))],
			DiasEnFondo: rng.Intn(120),
		}
		for k := rng.Intn(3); k > 0; k-- {
			d.OrganizacionesExcluidas = append(d.OrganizacionesExcluidas, int64(2000+rng.Intn(orgs)))
		}
		donaciones[i] = d
	}

	candidatos := make([]Candidato, m)
	for j := range candidatos {
		c := Candidato{
			NecesidadID:             int64(j + 1000),
			OrganizacionID:          int64(2000 + j%orgs),
			Latitud:                 latCentro + (rng.Float64()-0.5)*0.36,
			Longitud:                lngCentro + (rng.Float64()-0.5)*0.36,
			Deficit:                 rng.Float64() * 3,
			Urgencia:                rng.Float64(),
			DiasDesdeUltimaDonacion: rng.Intn(120),
			TasaCumplimiento:        rng.Float64(),
		}
		if rng.Intn(3) == 0 { // a third of the organizaciones restrict categories
			c.CategoriasAceptadas = []string{categorias[rng.Intn(len(categorias))], categorias[rng.Intn(len(categorias))]}
		}
		candidatos[j] = c
	}
	return donaciones, candidatos
}

// BenchmarkRonda500x500 measures one full round at the worker's input cap (RNF18, limiteItems =
// 500 in internal/contrato). It calls assign.Ronda, the same function the HTTP handler and the
// CLI `assign` subcommand invoke after decoding the contract.
func BenchmarkRonda500x500(b *testing.B) {
	donaciones, candidatos := fixtureRonda(500, 500, 42)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		res := Ronda(donaciones, candidatos, PesosPorDefecto, ParametrosPorDefecto)
		if len(res.Asignaciones)+len(res.SinAsignar) != len(donaciones) {
			b.Fatalf("lost donations: %d assigned + %d unassigned != %d",
				len(res.Asignaciones), len(res.SinAsignar), len(donaciones))
		}
	}
}
