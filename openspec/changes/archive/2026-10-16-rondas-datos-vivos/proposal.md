# Proposal: Rondas on Live Data (rondas-datos-vivos)

## Intent

Rondas must score candidates with real, current data. ReNaCoM and Censo 2022 were only a seed:
imported into Hornero's database, cleaned, and claimed by people. Today the worker resolves the
`deficit` term from CSVs baked into its image (`vulnerabilidad-radios.csv`, `renacom.csv`), generated
offline with `necesidadesAbiertas = 0`, so the score ignores current organizaciones, their `estado`,
open necesidades, and every platform-created organizacion (which never gets a `codigo_radio`).

Success: when an ADMINISTRADOR triggers a ronda, each candidate's `deficit` is computed by the MS
from the current database, platform and imported organizaciones are treated alike, and the worker
`serve` mode no longer depends on any CSV.

## Scope

### In Scope
- **PR1 (MS — data + aggregate + factory)**
  - `poblacion_radio` table (2022 radio code, population) plus an idempotent import (`\copy`-based,
    re-runnable) of the existing population dataset (~66.5k rows).
  - Ronda-time vulnerability aggregate in the MS, one native query per ronda:
    - comedores = organizaciones `APROBADA` + `SIN_RECLAMAR` with coordinates and `codigo_radio`;
      `INACTIVA`, `PENDIENTE`, `RECHAZADA` excluded.
    - open necesidades = `ABIERTA` + `EN_PROGRESO`, using the same "uncovered" definition as
      `/organizaciones/mapa`.
    - `v = hpc / median * (1 + necesidades / comedores)`, where `hpc` = habitantes per comedor in the
      radio and `median` = `percentile_cont(0.5)` over radios that have at least one comedor.
  - `EntradaRondaFactory` fills `codigoRadio` and `deficit` (source PROVISTO) per candidate; an
    organizacion without a resolvable radio gets NEUTRAL 1.0, recorded in `deficitFuente`.
  - `asistentes_declarados` is NOT used in the formula.
- **PR2 (worker)**
  - `serve` starts and assigns without CSVs; CSVs leave the Docker image but remain supported by the
    `metrics` / `assign` CLI subcommands.
  - New `POST /v1/radio` (stdlib point-in-polygon) over simplified 2022 radio polygons. Measure the
    simplified asset size first, then decide: commit the asset vs fetch at build time.
- **PR3 (MS — radio resolution + backfill)**
  - `OrganizacionService.crear` / `editar` resolve `codigo_radio` via the worker when coordinates
    change, best-effort (worker down or no match → null → NEUTRAL in rondas).
  - Backfill for existing platform organizaciones that have coordinates but no radio.

### Out of Scope
- `/mapa` choropleth moving to live data (follow-up).
- Map payload scaling (follow-up, recorded below).
- Weighting by `asistentes_declarados`.
- Non-2022 radio vintages (only 2022 codes join with population).
- PostGIS or any change to the Postgres image.

### Follow-up: `/organizaciones/mapa` payload scaling (recorded, not planned here)
Today `/organizaciones/mapa` returns every `APROBADA` + `SIN_RECLAMAR` organizacion with coordinates
(~200 bytes each uncompressed: ~550 KB for 2,730 orgs, ~6 MB at 30k). The BFF sends no
`Content-Encoding` (Cloudflare compresses only edge→browser) and Cloudflare does not cache that
JSON; Leaflet draws 2 canvas circle markers per organizacion. Scaling ladder:
1. BFF response compression + add `/organizaciones/mapa` to the Cloudflare cache rule.
2. Viewport (bbox) loading with server-side clustering / departamento aggregates at low zoom.
3. Vector tiles (PMTiles on R2) beyond ~100k points.

## Capabilities

### New Capabilities
- `ronda-vulnerabilidad-viva`: population data storage/import and the ronda-time live vulnerability
  aggregate (comedor and necesidad definitions, formula, median scope, NEUTRAL fallback).
- `organizacion-radio-censal`: resolving and storing an organizacion's 2022 `codigo_radio` from its
  coordinates (worker `POST /v1/radio`, best-effort on crear/editar, backfill).

### Modified Capabilities
- `ronda-asignacion`: the MS MUST supply `codigoRadio` and a live `deficit` (PROVISTO, or NEUTRAL
  with `deficitFuente`) per candidate; the worker `serve` mode MUST NOT require CSV data.

## Approach

Exploration Approach 1, delivered as three chained PRs (stacked-to-main, merged in order). The MS
owns the live aggregate because it owns the data; the worker stays a stateless solver plus a
geometry service. The existing contract already carries `codigoRadio` and `deficit`, so no schema
version bump is needed; the worker's PROVISTO branch takes precedence over its CSV fallbacks.
Radio resolution must exist before platform organizaciones count as comedores, so PR1 is useful
immediately for imported organizaciones (which already have `codigo_radio`) and PR3 closes the gap
for platform organizaciones. Strict TDD, with a minimal test set (no excessive tests).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `scripts/sql/V0xx_poblacion_radio.sql` + Makefile import target | New | table + idempotent population import |
| `jar_hornero_ms` ronda package (`EntradaRondaFactory`, `RondaService`, new aggregate repository/query) | Modified/New | live deficit per candidate |
| `jar_hornero_ms` `OrganizacionService` (`crear`/`editar`) + worker client | Modified | best-effort radio resolution |
| `jar_hornero_ms` backfill (command or admin-triggered job) | New | radio for existing platform orgs |
| `go_algorithms_worker/main.go`, `internal/geo` | Modified | `serve` without CSVs; data optional |
| `go_algorithms_worker` HTTP server + polygon asset | New | `POST /v1/radio` |
| `go_algorithms_worker/Dockerfile` | Modified | stop copying CSVs / `--data` for serve; ship polygons |

No access-rule change: `/v1/radio` is worker-internal (no host port), and `POST /api/rondas` keeps
its existing ADMINISTRADOR enforcement in MS `SecurityConfig`, BFF `@Roles`, and SPA `ProtectedRoute`.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Simplified polygon asset too large for repo or Pi image | Med | Measure first; build-time fetch if too large; tune simplification tolerance |
| Ronda scores shift versus baked CSV (median scope, live necesidades) | High (expected) | Document as intended; `deficitFuente` per candidate keeps scores explainable |
| Worker down on org crear/editar | Med | Best-effort, null radio → NEUTRAL; backfill re-runnable |
| Platform orgs NEUTRAL between PR1 and PR3 | High (temporary) | Merge PR3 promptly; behavior is explicit, not silent |
| Radio vintage mismatch (non-2022 codes) | Low | Only 2022 polygons and population are used |
| Aggregate query cost at ronda time | Low | Single grouped query over indexed `codigo_radio`; rondas are manual and rare |

## Rollback Plan

- PR3: revert; stored `codigo_radio` values are harmless and remain valid inputs.
- PR2: revert to restore CSVs in the image and the `--data` entrypoint; `/v1/radio` disappears and PR3
  resolution degrades to null (NEUTRAL) by design.
- PR1: revert the factory/aggregate; the worker falls back to its CSV resolution (if PR2 is still
  present, to NEUTRAL). `poblacion_radio` can stay (unused) or be dropped manually; the migration is
  additive and touches no existing table.
- Each PR is independently revertible in reverse merge order; take `make backup` before `make migrate`.

## Dependencies

- Existing population dataset (`poblacion-radios.csv`, ~66.5k rows) and 2022 radio polygons
  (`radios.parquet`, ~65 MB, uncommitted) to derive the simplified asset.
- `make migrate` / `scripts/sql` conventions for the new table.
- PR2 merged before PR3 (PR3 calls `POST /v1/radio`).

## Success Criteria

- [ ] A ronda input carries `codigoRadio` and a MS-computed `deficit` (PROVISTO) for every candidate
      whose organizacion has a radio, and NEUTRAL 1.0 with `deficitFuente` otherwise.
- [ ] Changing an organizacion's `estado` or opening/closing a necesidad changes the next ronda's
      `deficit` values without rebuilding the worker.
- [ ] Worker `serve` starts and answers rondas with no CSV in the image; `metrics`/`assign` CLI still work.
- [ ] A newly created or edited platform organizacion gets a `codigo_radio` when the worker is up;
      the backfill fills existing ones.
- [ ] Population import is re-runnable with identical results.
