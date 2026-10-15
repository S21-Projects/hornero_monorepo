package radios

import (
	"strings"
	"testing"
)

// Tiny synthetic radios (GeoJSON order is [lng, lat]); 0.001 degree is about 95 m at this latitude.
const fixtureNDJSON = `
{"c":"000000001","g":{"type":"Polygon","coordinates":[[[-64.20,-31.41],[-64.19,-31.41],[-64.19,-31.40],[-64.20,-31.40],[-64.20,-31.41]]]}}
{"c":"000000002","g":{"type":"Polygon","coordinates":[[[-64.30,-31.41],[-64.28,-31.41],[-64.28,-31.39],[-64.30,-31.39],[-64.30,-31.41]],[[-64.295,-31.405],[-64.285,-31.405],[-64.285,-31.395],[-64.295,-31.395],[-64.295,-31.405]]]}}
{"c":"000000003","g":{"type":"MultiPolygon","coordinates":[[[[-64.50,-31.41],[-64.49,-31.41],[-64.49,-31.40],[-64.50,-31.40],[-64.50,-31.41]]],[[[-64.45,-31.41],[-64.44,-31.41],[-64.44,-31.40],[-64.45,-31.40],[-64.45,-31.41]]]]}}
{"c":"000000005","g":{"type":"Polygon","coordinates":[[[-64.60,-31.41],[-64.59,-31.41],[-64.59,-31.40],[-64.60,-31.40],[-64.60,-31.41]]]}}
{"c":"000000004","g":{"type":"Polygon","coordinates":[[[-64.59,-31.41],[-64.58,-31.41],[-64.58,-31.40],[-64.59,-31.40],[-64.59,-31.41]]]}}
{"c":"000000006","g":{"type":"Polygon","coordinates":[[[-65.50,-30.50],[-63.50,-30.50],[-63.50,-28.50],[-65.50,-28.50],[-65.50,-30.50]]]}}
`

func TestBuscar(t *testing.T) {
	indice, err := Cargar(strings.NewReader(fixtureNDJSON))
	if err != nil {
		t.Fatalf("Cargar: %v", err)
	}

	tests := []struct {
		name     string
		lat, lng float64
		want     string
		ok       bool
	}{
		{"inside a polygon", -31.405, -64.195, "000000001", true},
		{"inside the hole of a polygon is outside it", -31.400, -64.290, "", false},
		{"inside the ring body around a hole", -31.392, -64.290, "000000002", true},
		{"second part of a multipolygon", -31.405, -64.445, "000000003", true},
		{"on a shared edge the lowest code wins", -31.405, -64.59, "000000004", true},
		{"near miss within 25 m of an edge", -31.405, -64.2001, "000000001", true},
		{"a hundred metres from every edge is not found", -31.405, -64.201, "", false},
		{"outside every polygon", 0, 0, "", false},
		{"inside a polygon too large for the grid", -29.50, -64.50, "000000006", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := indice.Buscar(tt.lat, tt.lng)
			if got != tt.want || ok != tt.ok {
				t.Errorf("Buscar(%v, %v) = (%q, %v), want (%q, %v)", tt.lat, tt.lng, got, ok, tt.want, tt.ok)
			}
		})
	}
}
