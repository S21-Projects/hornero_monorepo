# Worker contract v1 — `POST /v1/ronda`

Versioned, additive-only (AD-14). Callers send `"version": 1`; an unsupported major version
answers `400 VERSION_NO_SOPORTADA`. v1 only grows optional fields — a breaking change ships as
`/v2/ronda`, never as a silently incompatible edit to this one.

The Go types behind this document live in `internal/contrato/ronda_v1.go`. The golden fixtures at
`testdata/ronda-v1/{request,response}.json` are asserted byte-for-shape by
`internal/api/handler_test.go`'s `TestRondaGoldenRoundtrip`, and are **copied into**
`jar_hornero_ms/src/test/resources/contract/` (first in slice 5c, re-copied in slice 6b) — both
copies change together, in the same commit, whenever this contract changes.

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
      "organizacionesExcluidas": [5],
      "articuloIds": [101, 102]
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
      "categoriasPermitidas": ["NO_PERECEDERO"],
      "articuloIds": [102, 103],
      "cumplimiento": { "entregadas": 8, "fallidas": 1 }
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
- `candidatos[].cumplimiento` is additive (AD-11, slice 6a): `{entregadas, fallidas}` raw counts,
  already classified MS-side (`ENTREGADA`→entregada, `RECHAZADA`→fallida, `CANCELADA` and
  non-terminal donaciones excluded from both). Absent/`null` is equivalent to `{0, 0}` — the
  candidate simply receives the ronda's neutral prior, with no special handling required on
  either side. The worker computes `p0` (the prior) as the average resolved rate across every
  candidate in the ronda that has history, or `0.5` if nobody does, then smooths each candidate's
  own rate toward it with `m` pseudo-observations: `tasa = (entregadas + m·p0) / (entregadas +
  fallidas + m)`.
- `donaciones[].articuloIds`/`candidatos[].articuloIds` are additive (feature catalogo-articulos,
  work unit C): the catalog articulo ids a donación offers / a necesidad requested. When **both**
  sides declare a non-empty set, the pair is only feasible if the sets intersect — a hard filter,
  alongside (never instead of) the existing `categoriasAceptadas`/`categoriasPermitidas` filter.
  When either side is absent/empty (a producer that has not been updated yet), the filter is a
  no-op, same "empty means accepts anything" convention as every other optional set field here —
  this keeps the contract backward compatible mid-rollout.
- `pesos`/`parametros` are optional overrides of `assign.PesosPorDefecto` /
  `assign.ParametrosPorDefecto`. Every field inside `parametros` is itself optional — only the
  ones present replace the default. `pesos.cumplimiento` (slice 6a) weights the compliance term;
  `parametros.cumplimientoPrior` overrides the computed `p0` outright; `parametros.
  cumplimientoPseudoObs` overrides `m` (default `5`).
- Body is capped at 1 MiB; `donaciones`/`candidatos` are each capped at 500 items; every
  coordinate must be finite and within `[-90, 90]` / `[-180, 180]`. `categoria` and
  `categoriasAceptadas`/`categoriasPermitidas` are free-text pass-through — an unrecognized value
  is never rejected, it is simply never matched by a candidate that does not list it.
- Numeric values that would break the score are rejected with `400 ENTRADA_INVALIDA`:
  `distanciaMediaKm`, `esperaMaximaDias`, `deficitMaximo` and `cumplimientoPseudoObs` must be `> 0`;
  `distanciaMaximaKm`, `penalizacionNoAsignar` and `radioResolucionKm` `>= 0`;
  `cumplimientoPrior` in `[0, 1]`; `pesos` all `>= 0` with at least one `> 0`; `urgencia` in
  `[0, 1]`; `deficit`, `diasEnFondo`, `diasDesdeUltimaDonacion` and `cumplimiento` counts `>= 0`;
  donation `id` and `necesidadId` unique within the request.

## Response — 200

```jsonc
{
  "version": 1,
  "asignaciones": [
    {
      "donacionId": 17,
      "necesidadId": 40,
      "organizacionId": 8,
      "score": 0.5327,
      "distanciaKm": 2.1998,
      "costoOportunidad": 0,
      "desglose": { "deficit": 0.3333, "urgencia": 0.6, "proximidad": 0.7596, "espera": 0.1556,
                    "cumplimiento": 0.8889 },
      "deficitFuente": "NEUTRAL",
      "codigoRadio": ""
    }
  ],
  "sinAsignar": [],
  "scoreTotal": 0.5327,
  "pesos": { "deficit": 0.30, "urgencia": 0.25, "proximidad": 0.17, "espera": 0.13, "cumplimiento": 0.15 },
  "parametros": {
    "distanciaMediaKm": 8, "distanciaMaximaKm": 30, "esperaMaximaDias": 90,
    "deficitMaximo": 3, "penalizacionNoAsignar": 0.10, "cumplimientoPseudoObs": 5
  }
}
```

- `desglose` (AD-14, née `ScoreDetallado`) carries the five normalized [0,1] terms behind
  `score`, including `cumplimiento` (AD-11, slice 6a) — a plain passthrough of the candidate's
  smoothed rate, already computed server-side.
- `desglose`/`score` are computed from `Pesos.Normalizados()`: every weight (present or
  defaulted) is divided by the sum of all five, so a request's weights need not sum to 1 and
  configuring `cumplimiento: 0` reproduces the pre-6a four-term formula exactly.
  `assign.PesosPorDefecto` is now `{deficit: 0.30, urgencia: 0.25, proximidad: 0.17, espera: 0.13,
  cumplimiento: 0.15}` (previously `{0.35, 0.30, 0.20, 0.15}` with no compliance term).
- `deficitFuente` is one of `PROVISTO | RADIO | CERCANO | NEUTRAL` (AD-2) — which rule resolved
  this candidate's coverage deficit. Until the INDEC population CSV is mounted (`POBLACION_CSV`),
  every candidate resolves to `NEUTRAL` — a known, documented limitation, not a bug.
- `sinAsignar` always lists every unmatched donación id explicitly — never omitted.
- `pesos`/`parametros` echo back the values actually applied (defaults merged with any request
  override), for explainability/audit. `parametros.cumplimientoPseudoObs` is new in slice 6a.

## Response — 400 / 413

```jsonc
{ "error": "VERSION_NO_SOPORTADA" | "ENTRADA_INVALIDA" | "CUERPO_DEMASIADO_GRANDE", "detalle": "..." }
```

`CUERPO_DEMASIADO_GRANDE` is `413`, both `VERSION_NO_SOPORTADA` and `ENTRADA_INVALIDA` are `400`.

## `GET /healthz`

Plain `200 ok`. Backs the compose healthcheck; carries no payload contract.
