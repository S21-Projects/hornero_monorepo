// Package radios answers "which 2022 census radio contains this point?" for POST /v1/radio.
//
// The index is built once at startup from a gzipped NDJSON asset (one {"c":code,"g":GeoJSON} line per
// radio, see scripts/mapa/radios.sql). Lookups use a uniform grid over polygon bounding boxes, an
// even-odd ray cast over all rings (so holes need no orientation logic) and, when no polygon contains
// the point, a nearest-edge fallback: the asset is simplified, which opens small gaps between
// neighbours, and street-geocoded comedores sit exactly on radio borders.
package radios

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
)

const (
	// tamanoCeldaGrados is the grid cell size in degrees (about 5.5 km).
	tamanoCeldaGrados = 0.05
	// maxCeldasPorPoligono sends polygons whose bounding box spans more cells than this to the
	// "grandes" list, checked on every query, instead of being registered cell by cell.
	maxCeldasPorPoligono = 400
	// toleranciaMetros is the near-miss radius, about the simplification tolerance of the asset
	// (0.0002 degrees is roughly 20 m).
	toleranciaMetros = 25.0
	metrosPorGrado   = 111320.0
	// margenGrados widens bounding boxes for the near-miss prefilter (25 m is about 0.00023 degrees).
	margenGrados = 0.0005
)

type punto struct{ lng, lat float64 }

type poligono struct {
	codigo                         string
	anillos                        [][]punto
	minLng, minLat, maxLng, maxLat float64
}

// Indice is the immutable, read-only lookup structure; safe for concurrent use after Cargar.
type Indice struct {
	poligonos []poligono
	celdas    map[int64][]int32
	grandes   []int32
}

type lineaRadio struct {
	Codigo   string `json:"c"`
	Geometry struct {
		Type        string          `json:"type"`
		Coordinates json.RawMessage `json:"coordinates"`
	} `json:"g"`
}

// Cargar streams the NDJSON from r (the caller wraps a gzip reader when needed) and builds the index.
func Cargar(r io.Reader) (*Indice, error) {
	dec := json.NewDecoder(r)
	idx := &Indice{celdas: make(map[int64][]int32)}
	for n := 1; ; n++ {
		var l lineaRadio
		if err := dec.Decode(&l); err == io.EOF {
			break
		} else if err != nil {
			return nil, fmt.Errorf("radios: registro %d: %w", n, err)
		}
		partes, err := poligonosDe(l)
		if err != nil {
			return nil, fmt.Errorf("radios: radio %q: %w", l.Codigo, err)
		}
		for _, anillos := range partes {
			idx.agregar(l.Codigo, anillos)
		}
	}
	return idx, nil
}

// poligonosDe decodes a Polygon or MultiPolygon into a list of polygons, each a list of rings.
func poligonosDe(l lineaRadio) ([][][]punto, error) {
	switch l.Geometry.Type {
	case "Polygon":
		var coords [][][2]float64
		if err := json.Unmarshal(l.Geometry.Coordinates, &coords); err != nil {
			return nil, err
		}
		return [][][]punto{anillosDe(coords)}, nil
	case "MultiPolygon":
		var coords [][][][2]float64
		if err := json.Unmarshal(l.Geometry.Coordinates, &coords); err != nil {
			return nil, err
		}
		partes := make([][][]punto, 0, len(coords))
		for _, p := range coords {
			partes = append(partes, anillosDe(p))
		}
		return partes, nil
	default:
		return nil, fmt.Errorf("geometria no soportada %q", l.Geometry.Type)
	}
}

func anillosDe(coords [][][2]float64) [][]punto {
	anillos := make([][]punto, len(coords))
	for i, anillo := range coords {
		anillos[i] = make([]punto, len(anillo))
		for j, c := range anillo {
			anillos[i][j] = punto{lng: c[0], lat: c[1]}
		}
	}
	return anillos
}

func (idx *Indice) agregar(codigo string, anillos [][]punto) {
	p := poligono{codigo: codigo, anillos: anillos,
		minLng: math.Inf(1), minLat: math.Inf(1), maxLng: math.Inf(-1), maxLat: math.Inf(-1)}
	for _, anillo := range anillos {
		for _, v := range anillo {
			p.minLng, p.maxLng = math.Min(p.minLng, v.lng), math.Max(p.maxLng, v.lng)
			p.minLat, p.maxLat = math.Min(p.minLat, v.lat), math.Max(p.maxLat, v.lat)
		}
	}
	if len(p.anillos) == 0 || math.IsInf(p.minLng, 1) {
		return
	}
	id := int32(len(idx.poligonos))
	idx.poligonos = append(idx.poligonos, p)

	x0, x1, y0, y1 := celda(p.minLng), celda(p.maxLng), celda(p.minLat), celda(p.maxLat)
	if (x1-x0+1)*(y1-y0+1) > maxCeldasPorPoligono {
		idx.grandes = append(idx.grandes, id)
		return
	}
	for x := x0; x <= x1; x++ {
		for y := y0; y <= y1; y++ {
			k := clave(x, y)
			idx.celdas[k] = append(idx.celdas[k], id)
		}
	}
}

func celda(grados float64) int { return int(math.Floor(grados / tamanoCeldaGrados)) }

func clave(x, y int) int64 { return int64(x)*1_000_000 + int64(y) }

// Buscar returns the code of the radio containing the point. A point on a shared edge belongs to
// the lowest code. When no polygon contains it, the nearest edge within 25 m wins; beyond that
// the point has no radio.
func (idx *Indice) Buscar(lat, lng float64) (string, bool) {
	cx, cy := celda(lng), celda(lat)
	candidatos := append(append([]int32(nil), idx.celdas[clave(cx, cy)]...), idx.grandes...)

	mejor := ""
	for _, id := range candidatos {
		p := &idx.poligonos[id]
		if contiene(p, lat, lng) && (mejor == "" || p.codigo < mejor) {
			mejor = p.codigo
		}
	}
	if mejor != "" {
		return mejor, true
	}

	// Near miss: also look at the neighbouring cells, the point may sit just across a cell border.
	candidatos = candidatos[:0]
	for x := cx - 1; x <= cx+1; x++ {
		for y := cy - 1; y <= cy+1; y++ {
			candidatos = append(candidatos, idx.celdas[clave(x, y)]...)
		}
	}
	candidatos = append(candidatos, idx.grandes...)
	mejorDist := toleranciaMetros
	for _, id := range candidatos {
		p := &idx.poligonos[id]
		if lng < p.minLng-margenGrados || lng > p.maxLng+margenGrados ||
			lat < p.minLat-margenGrados || lat > p.maxLat+margenGrados {
			continue
		}
		d := distanciaABordeMetros(p, lat, lng)
		if d < mejorDist || (d == mejorDist && mejor != "" && p.codigo < mejor) {
			mejorDist, mejor = d, p.codigo
		}
	}
	return mejor, mejor != ""
}

// contiene reports whether the point is inside the polygon (even-odd over every ring, so holes
// exclude it) or on its boundary.
func contiene(p *poligono, lat, lng float64) bool {
	if lng < p.minLng || lng > p.maxLng || lat < p.minLat || lat > p.maxLat {
		return false
	}
	dentro := false
	for _, anillo := range p.anillos {
		for i, j := 0, len(anillo)-1; i < len(anillo); j, i = i, i+1 {
			a, b := anillo[i], anillo[j]
			if enSegmento(a, b, lng, lat) {
				return true
			}
			if (a.lat > lat) != (b.lat > lat) && lng < (b.lng-a.lng)*(lat-a.lat)/(b.lat-a.lat)+a.lng {
				dentro = !dentro
			}
		}
	}
	return dentro
}

// enSegmento reports whether (x, y) lies exactly on segment a-b (within float noise), so a point on a
// shared edge counts as inside both neighbours and the lowest code wins deterministically.
func enSegmento(a, b punto, x, y float64) bool {
	const eps = 1e-12
	cruz := (b.lng-a.lng)*(y-a.lat) - (b.lat-a.lat)*(x-a.lng)
	if math.Abs(cruz) > eps {
		return false
	}
	return x >= math.Min(a.lng, b.lng)-eps && x <= math.Max(a.lng, b.lng)+eps &&
		y >= math.Min(a.lat, b.lat)-eps && y <= math.Max(a.lat, b.lat)+eps
}

// distanciaABordeMetros is the distance from the point to the closest ring edge, in flat-earth
// meters at the point's latitude (accurate enough for a 25 m tolerance).
func distanciaABordeMetros(p *poligono, lat, lng float64) float64 {
	kx := math.Cos(lat*math.Pi/180) * metrosPorGrado
	ky := metrosPorGrado
	mejor := math.Inf(1)
	for _, anillo := range p.anillos {
		for i, j := 0, len(anillo)-1; i < len(anillo); j, i = i, i+1 {
			ax, ay := (anillo[i].lng-lng)*kx, (anillo[i].lat-lat)*ky
			bx, by := (anillo[j].lng-lng)*kx, (anillo[j].lat-lat)*ky
			mejor = math.Min(mejor, distanciaOrigenASegmento(ax, ay, bx, by))
		}
	}
	return mejor
}

// distanciaOrigenASegmento is the distance from (0,0) to segment (ax,ay)-(bx,by).
func distanciaOrigenASegmento(ax, ay, bx, by float64) float64 {
	dx, dy := bx-ax, by-ay
	largo2 := dx*dx + dy*dy
	t := 0.0
	if largo2 > 0 {
		t = math.Max(0, math.Min(1, -(ax*dx+ay*dy)/largo2))
	}
	return math.Hypot(ax+t*dx, ay+t*dy)
}
