# Exploration: rondas-datos-vivos

Mirror of Engram `sdd/rondas-datos-vivos/explore` (obs #762), condensed by the orchestrator.

## Intent (user, 2026-10-15)

Rondas must run on real, current data. ReNaCoM and Censo 2022 were a seed: imported into Hornero's
database, cleaned, and claimed by people. When a pooled donation is assigned, the score must use
the current database (organizations, estados, open necesidades, population), not CSVs baked into
the worker image.

## Current state

- Worker resolves `deficit` PROVISTO > RADIO > CERCANO > NEUTRAL (`internal/geo/deficit.go:114-127`)
  from CSVs copied into the image (`vulnerabilidad-radios.csv`, `renacom.csv`), generated offline by
  `make mapa-datos` from the ReNaCoM fixture (necesidadesAbiertas = 0). `geo.Cargar` fails without
  `renacom.csv`.
- The contract already accepts `codigoRadio` and `deficit` per candidate; the MS DTO has both fields;
  `EntradaRondaFactory.candidatoEntrada` never fills them.
- `organizaciones.codigo_radio` is filled only for ReNaCoM imports (2022 radio by point-in-polygon in
  DuckDB). Platform orgs set coordinates in `OrganizacionService.crear`/`editar` and never get a radio.
  No population table, no polygons at runtime, no PostGIS (`postgres:16-alpine`).
- Radio code `PP DDD FF RR`: `left(code, 5)` = departamento, `left(code, 2)` = provincia.
- Candidates require a referente, so SIN_RECLAMAR orgs count as comedores in coverage but are never
  candidates.

## Approaches

| | 1. MS-live + stored radio + worker polygon endpoint | 2. MS-live + nearest-imported-org radio | 3. Periodic CSV refresh |
|---|---|---|---|
| Pros | Always current; cheap SQL aggregate; worker stateless with no CSVs; platform and imported orgs treated alike; contract reused | No polygons, smaller | Least change |
| Cons | New MS→worker call on org create/edit (best-effort + backfill); polygon asset to size and ship; CERCANO leaves the live path | Wrong at radio borders, empty without ReNaCoM nearby | Not live; DuckDB not on the Pi; platform radios still missing |
| Effort | Medium–High (3 PRs) | Medium (2 PRs) | Medium |

## Recommendation

Approach 1 as three chained PRs:
1. `poblacion_radio` table + import (`\copy`, idempotent), ronda-time aggregate in the MS
   (`percentile_cont` median; comedores = APROBADA + SIN_RECLAMAR with coordinates and radio; open
   necesidades ABIERTA + EN_PROGRESO; `v = hpc/median * (1 + necesidades/comedores)`), factory sends
   `codigoRadio` + `deficit` (PROVISTO). Imported orgs are live after this PR.
2. Worker: data loading optional for `serve`, CSVs out of the image (kept for `metrics`/`assign` CLI),
   `POST /v1/radio` with simplified 2022 radio polygons (measure the asset size first).
3. MS: resolve the radio on org create/edit (best-effort, null → NEUTRAL) + backfill of existing
   platform orgs.

## Open product questions (recommended defaults)

1. SIN_RECLAMAR orgs count as comedores in coverage — yes.
2. INACTIVA (and PENDIENTE, RECHAZADA) excluded — yes.
3. Org without a resolvable radio → NEUTRAL 1.0, recorded in `deficitFuente` — yes.
4. `asistentes_declarados` weights the formula — no, for now.
5. `/mapa` choropleth moves to live data in this change — no, follow-up.

## Risks

Polygon asset size (65 MB parquet uncommitted; simplified size unmeasured); radio vintage (only 2022
codes match population); worker down during org create/edit (best-effort + backfill); ronda scores
change versus the baked CSV; median scope drift shifts every score.
