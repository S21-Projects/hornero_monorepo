package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"testing"

	"algorithms/internal/geo"
)

func resolvedorVacio() *geo.Resolvedor {
	// No RENACOM data loaded: every candidate resolves to NEUTRAL (AD-2's documented known
	// limitation), which keeps the golden fixture's numbers independent of the dataset.
	return geo.NuevoResolvedor(nil, nil, 1.0)
}

func leerFixture(t *testing.T, nombre string) []byte {
	t.Helper()
	b, err := os.ReadFile("../../testdata/ronda-v1/" + nombre)
	if err != nil {
		t.Fatalf("leyendo fixture %s: %v", nombre, err)
	}
	return b
}

func TestHealthz(t *testing.T) {
	h := NuevoHandler(resolvedorVacio())
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	h.Rutas().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestRondaRequestValidoDevuelve200(t *testing.T) {
	body := leerFixture(t, "request.json")
	h := NuevoHandler(resolvedorVacio())
	req := httptest.NewRequest(http.MethodPost, "/v1/ronda", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Rutas().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestRondaRequestInvalidoDevuelve400(t *testing.T) {
	h := NuevoHandler(resolvedorVacio())
	req := httptest.NewRequest(http.MethodPost, "/v1/ronda", bytes.NewReader([]byte(`{"version":2,"donaciones":[],"candidatos":[]}`)))
	rec := httptest.NewRecorder()

	h.Rutas().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400, body = %s", rec.Code, rec.Body.String())
	}
	var envelope struct{ Error, Detalle string }
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decoding error envelope: %v", err)
	}
	if envelope.Error != "VERSION_NO_SOPORTADA" {
		t.Fatalf("error = %q, want VERSION_NO_SOPORTADA", envelope.Error)
	}
}

func TestRondaCuerpoDemasiadoGrandeDevuelve413(t *testing.T) {
	// A well-formed JSON object whose padding alone is 2 MiB, over the 1 MiB AD-14 limit — the
	// body must be valid-looking JSON so the decoder reads far enough to hit the byte cap
	// instead of failing on the first malformed byte.
	relleno := bytes.Repeat([]byte("a"), 2<<20)
	grande := append(append([]byte(`{"version":1,"donaciones":[],"candidatos":[],"_relleno":"`), relleno...), []byte(`"}`)...)
	h := NuevoHandler(resolvedorVacio())
	req := httptest.NewRequest(http.MethodPost, "/v1/ronda", bytes.NewReader(grande))
	rec := httptest.NewRecorder()

	h.Rutas().ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413, body = %s", rec.Code, rec.Body.String())
	}
}

func TestRondaMetodoNoPermitido(t *testing.T) {
	h := NuevoHandler(resolvedorVacio())
	req := httptest.NewRequest(http.MethodGet, "/v1/ronda", nil)
	rec := httptest.NewRecorder()

	h.Rutas().ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

// TestRondaGoldenRoundtrip is the 5a.6 golden fixture test: the committed request.json must
// produce exactly the committed response.json. Regenerate response.json deliberately (never by
// hand) whenever a scoring/contract change legitimately moves these numbers.
func TestRondaGoldenRoundtrip(t *testing.T) {
	reqBody := leerFixture(t, "request.json")
	wantBody := leerFixture(t, "response.json")

	h := NuevoHandler(resolvedorVacio())
	req := httptest.NewRequest(http.MethodPost, "/v1/ronda", bytes.NewReader(reqBody))
	rec := httptest.NewRecorder()
	h.Rutas().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var got, want any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decoding actual response: %v", err)
	}
	if err := json.Unmarshal(wantBody, &want); err != nil {
		t.Fatalf("decoding golden response.json: %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("response mismatch:\ngot:  %s\nwant: %s", rec.Body.String(), wantBody)
	}
}
