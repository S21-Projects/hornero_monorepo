package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"algorithms/internal/radios"
)

const radiosFixture = `{"c":"140140101","g":{"type":"Polygon","coordinates":[[[-64.20,-31.41],[-64.19,-31.41],[-64.19,-31.40],[-64.20,-31.40],[-64.20,-31.41]]]}}`

func TestRadio(t *testing.T) {
	indice, err := radios.Cargar(strings.NewReader(radiosFixture))
	if err != nil {
		t.Fatalf("radios.Cargar: %v", err)
	}

	tests := []struct {
		name       string
		metodo     string
		cuerpo     string
		indice     *radios.Indice
		wantStatus int
		wantCampo  string // key expected in the JSON body: "codigoRadio" or "error"
		wantValor  string
	}{
		{"point inside a radio", http.MethodPost, `{"latitud":-31.405,"longitud":-64.195}`, indice, 200, "codigoRadio", "140140101"},
		{"malformed JSON", http.MethodPost, `{"latitud":`, indice, 400, "error", "ENTRADA_INVALIDA"},
		{"missing longitud", http.MethodPost, `{"latitud":-31.405}`, indice, 400, "error", "ENTRADA_INVALIDA"},
		{"latitud out of range", http.MethodPost, `{"latitud":91,"longitud":-64.195}`, indice, 400, "error", "ENTRADA_INVALIDA"},
		{"longitud out of range", http.MethodPost, `{"latitud":-31.405,"longitud":181}`, indice, 400, "error", "ENTRADA_INVALIDA"},
		{"point outside every radio", http.MethodPost, `{"latitud":0,"longitud":0}`, indice, 404, "error", "RADIO_NO_ENCONTRADO"},
		{"asset not loaded", http.MethodPost, `{"latitud":-31.405,"longitud":-64.195}`, nil, 503, "error", "RADIOS_NO_DISPONIBLES"},
		{"only POST is allowed", http.MethodGet, ``, indice, 405, "error", "METODO_NO_PERMITIDO"},
		{"body over 4 KiB", http.MethodPost, `{"latitud":-31.405,"longitud":-64.195,"_relleno":"` + strings.Repeat("a", 5000) + `"}`, indice, 413, "error", "CUERPO_DEMASIADO_GRANDE"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NuevoHandler(resolvedorVacio(), tt.indice)
			req := httptest.NewRequest(tt.metodo, "/v1/radio", strings.NewReader(tt.cuerpo))
			rec := httptest.NewRecorder()

			h.Rutas().ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d, body = %s", rec.Code, tt.wantStatus, rec.Body.String())
			}
			var cuerpo map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &cuerpo); err != nil {
				t.Fatalf("decoding body %q: %v", rec.Body.String(), err)
			}
			if got := cuerpo[tt.wantCampo]; got != tt.wantValor {
				t.Errorf("%s = %v, want %q (body %s)", tt.wantCampo, got, tt.wantValor, rec.Body.String())
			}
		})
	}
}
