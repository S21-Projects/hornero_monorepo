package assign

import "testing"

// candidatoConCategorias mirrors the candidato() helper in ronda_test.go, adding the two
// category fields under test here.
func candidatoConCategorias(categoriasAceptadas, categoriasPermitidas []string) Candidato {
	return Candidato{
		NecesidadID:          1,
		OrganizacionID:       100,
		Latitud:              latCentro,
		Longitud:             lngCentro,
		Deficit:              1,
		Urgencia:             0.5,
		CategoriasAceptadas:  categoriasAceptadas,
		CategoriasPermitidas: categoriasPermitidas,
	}
}

// TestAceptaCategoriasPermitidas: AD-10 — the accreditation level is a second hard filter,
// independent of CategoriasAceptadas (what the necesidad asked for).
func TestAceptaCategoriasPermitidas(t *testing.T) {
	donacion := Donacion{ID: 1, Latitud: latCentro, Longitud: lngCentro, Categoria: "REFRIGERADO"}

	tests := []struct {
		name                 string
		categoriasAceptadas  []string
		categoriasPermitidas []string
		wantOk               bool
	}{
		{
			name:                 "empty CategoriasPermitidas is a no-op, matching the empty CategoriasAceptadas rule",
			categoriasAceptadas:  nil,
			categoriasPermitidas: nil,
			wantOk:               true,
		},
		{
			name:                 "category in CategoriasAceptadas but not in CategoriasPermitidas is rejected",
			categoriasAceptadas:  []string{"REFRIGERADO"},
			categoriasPermitidas: []string{"NO_PERECEDERO"},
			wantOk:               false,
		},
		{
			name:                 "category in both sets is accepted",
			categoriasAceptadas:  []string{"REFRIGERADO"},
			categoriasPermitidas: []string{"REFRIGERADO", "CONGELADO"},
			wantOk:               true,
		},
		{
			name:                 "empty CategoriasAceptadas but a restrictive CategoriasPermitidas still filters",
			categoriasAceptadas:  nil,
			categoriasPermitidas: []string{"NO_PERECEDERO"},
			wantOk:               false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := candidatoConCategorias(tt.categoriasAceptadas, tt.categoriasPermitidas)

			_, ok := Score(donacion, c, PesosPorDefecto, ParametrosPorDefecto)

			if ok != tt.wantOk {
				t.Fatalf("Score() ok = %v, want %v", ok, tt.wantOk)
			}
		})
	}
}

// TestEmptyCategoriasPermitidasLeavesExistingRoundResultsUnchanged proves the field is additive:
// a full Ronda computed with CategoriasPermitidas unset (every caller before this producer
// exists) matches the same round computed with it explicitly empty.
func TestEmptyCategoriasPermitidasLeavesExistingRoundResultsUnchanged(t *testing.T) {
	donaciones := []Donacion{
		{ID: 1, Latitud: latCentro, Longitud: lngCentro, Categoria: "REFRIGERADO"},
		{ID: 2, Latitud: latCentro, Longitud: lngCentro, Categoria: ""},
	}

	base := []Candidato{
		candidato(10, 100, latCentro, lngCentro),
		candidato(11, 101, latCentro+0.05, lngCentro),
	}
	withEmptyPermitidas := []Candidato{
		{
			NecesidadID: base[0].NecesidadID, OrganizacionID: base[0].OrganizacionID,
			Latitud: base[0].Latitud, Longitud: base[0].Longitud,
			Deficit: base[0].Deficit, Urgencia: base[0].Urgencia,
			CategoriasPermitidas: []string{},
		},
		{
			NecesidadID: base[1].NecesidadID, OrganizacionID: base[1].OrganizacionID,
			Latitud: base[1].Latitud, Longitud: base[1].Longitud,
			Deficit: base[1].Deficit, Urgencia: base[1].Urgencia,
			CategoriasPermitidas: []string{},
		},
	}

	resBase := Ronda(donaciones, base, PesosPorDefecto, ParametrosPorDefecto)
	resEmptyPermitidas := Ronda(donaciones, withEmptyPermitidas, PesosPorDefecto, ParametrosPorDefecto)

	if len(resBase.Asignaciones) != len(resEmptyPermitidas.Asignaciones) {
		t.Fatalf("asignaciones = %d, want %d (empty CategoriasPermitidas must be a no-op)",
			len(resEmptyPermitidas.Asignaciones), len(resBase.Asignaciones))
	}
	for i := range resBase.Asignaciones {
		if resBase.Asignaciones[i] != resEmptyPermitidas.Asignaciones[i] {
			t.Fatalf("asignacion[%d] = %+v, want %+v (empty CategoriasPermitidas changed the outcome)",
				i, resEmptyPermitidas.Asignaciones[i], resBase.Asignaciones[i])
		}
	}
}
