# Worker contract v1 — `POST /v1/ronda`

Versioned, additive-only (AD-14). Callers send `"version": 1`; an unsupported major version
answers `400 VERSION_NO_SOPORTADA`. v1 only grows optional fields — a breaking change ships as
`/v2/ronda`, never as a silently incompatible edit to this one.

The Go types behind this document live in `internal/contrato/ronda_v1.go`. The golden fixtures at
`testdata/ronda-v1/{request,response}.json` are asserted byte-for-shape by
`internal/api/handler_test.go`'s `TestRondaGoldenRoundtrip`, and are **copied into**
`jar_hornero_ms/src/test/resources/contract/` in slice 5c — both copies change together, in the
same commit, whenever this contract changes.

## Request

```jsonc
{
  "version": 1,
  "donaciones": [
    {
      "id": 17,
      "latitud": -31.41,
      "longitud": -64.18,
      "categoria": "NO_PERECEDERO",
      "diasEnFondo": 12,
      "organizacionesExcluidas": [5]
    }
  ],
  "candidatos": [
    {
      "necesidadId": 40,
      "organizacionId": 8,
      "latitud": -31.40,
      "longitud": -64.20,
      "codigoRadio": null,
      "deficit": null,
      "urgencia": 0.6,
      "diasDesdeUltimaDonacion": 14,
      "categoriasAceptadas": ["NO_PERECEDERO"],
      "categoriasPermitidas": ["NO_PERECEDERO"]
    }
  ],
  "pesos": null,
  "parametros": null
}
```

- `donaciones[].diasEnFondo` and `organizacionesExcluidas` are additive (AD-10, AD-3). A producer
  that does not send them gets `0`/empty, which makes the per-donation unassignment penalty zero
  and the exclusion filter a no-op — behaviour-neutral until slice 5c wires the MS producer.
- `candidatos[].deficit` is a nullable override (AD-2): absent/`null` lets the worker resolve the
  coverage deficit itself (`codigoRadio` → nearest precise point → `1.0` neutral); present
  (including `0.0`) always wins.
- `pesos`/`parametros` are optional overrides of `assign.PesosPorDefecto` /
  `assign.ParametrosPorDefecto`. Every field inside `parametros` is itself optional — only the
  ones present replace the default.
- Body is capped at 1 MiB; `donaciones`/`candidatos` are each capped at 500 items; every
  coordinate must be finite and within `[-90, 90]` / `[-180, 180]`. `categoria` and
  `categoriasAceptadas`/`categoriasPermitidas` are free-text pass-through — an unrecognized value
  is never rejected, it is simply never matched by a candidate that does not list it.

## Response — 200

```jsonc
{
  "version": 1,
  "asignaciones": [
    {
      "donacionId": 17,
      "necesidadId": 40,
      "organizacionId": 8,
      "score": 0.4719,
      "distanciaKm": 2.1998,
      "costoOportunidad": 0,
      "desglose": { "deficit": 0.3333, "urgencia": 0.6, "proximidad": 0.7596, "espera": 0.1556 },
      "deficitFuente": "NEUTRAL",
      "codigoRadio": ""
    }
  ],
  "sinAsignar": [],
  "scoreTotal": 0.4719,
  "pesos": { "deficit": 0.35, "urgencia": 0.30, "proximidad": 0.20, "espera": 0.15 },
  "parametros": {
    "distanciaMediaKm": 8, "distanciaMaximaKm": 30, "esperaMaximaDias": 90,
    "deficitMaximo": 3, "penalizacionNoAsignar": 0.10
  }
}
```

- `desglose` (AD-14, née `ScoreDetallado`) carries the four normalized [0,1] terms behind
  `score`; a `cumplimiento` fifth term is added in slice 6a (AD-11), additively.
- `deficitFuente` is one of `PROVISTO | RADIO | CERCANO | NEUTRAL` (AD-2) — which rule resolved
  this candidate's coverage deficit. Until the INDEC population CSV is mounted (`POBLACION_CSV`),
  every candidate resolves to `NEUTRAL` — a known, documented limitation, not a bug.
- `sinAsignar` always lists every unmatched donación id explicitly — never omitted.
- `pesos`/`parametros` echo back the values actually applied (defaults merged with any request
  override), for explainability/audit.

## Response — 400 / 413

```jsonc
{ "error": "VERSION_NO_SOPORTADA" | "ENTRADA_INVALIDA" | "CUERPO_DEMASIADO_GRANDE", "detalle": "..." }
```

`CUERPO_DEMASIADO_GRANDE` is `413`, both `VERSION_NO_SOPORTADA` and `ENTRADA_INVALIDA` are `400`.

## `GET /healthz`

Plain `200 ok`. Backs the compose healthcheck; carries no payload contract.
