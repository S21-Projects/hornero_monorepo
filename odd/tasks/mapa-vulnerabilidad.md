# Feature: mapa-vulnerabilidad

Locator: `odd/tasks/mapa-vulnerabilidad.md` · Engram mirror: `odd/mapa-vulnerabilidad/tasks`
Branch: `feat/mapa-vulnerabilidad` (worktree `../hornero_app-mapa`, from `develop` @ `d2eed8b`)
Design: `docs/mapa-vulnerabilidad.md`

## Objective

National map of Argentina that paints **coverage deficit** (inhabitants per comedor vs
median) as the vulnerability signal, with a comedor density heatmap and Hornero
organizaciones as context layers. Same `deficit` term the ronda score weights at 0.35.

## Why

The current map is Córdoba-centred markers (50 orgs max). It shows where Hornero orgs are,
not where help is missing. Reusing the worker's coverage math makes the map explain the
assignment algorithm.

## Scope

- In: worker `metrics` departamento aggregation + GeoJSON/heat output; `make mapa-datos`;
  static data files; Astro island layers (choropleth, heatmap, markers), legend, tooltips,
  sample-bias disclaimer.
- Out: MS/BFF runtime endpoints; MapLibre migration; radio-level national polygons.

## Constraints

- Public site must not depend at runtime on the worker (internal-only, no host port).
- Another agent works on `feat/seguridad-mejoras` in the main worktree — never touch it.
- Commit only with explicit user permission; never push.

## Decisions

- 2026-10-12 — One combined dataset, not separate layers: ReNaCoM + census + Hornero data are
  cleaned and merged. Hornero organizaciones count as coverage (dedup against ReNaCoM;
  point-in-polygon to assign their radio). Open, uncovered necesidades raise a zone's
  vulnerability (user: "mientras más necesidades haya, mayor es la vulnerabilidad").
  Caveat: open necesidades are capped per accreditation level (`app.acreditacion.cap-n1..n3`
  = 3/6/12, `AcreditacionProperties`), so raw counts are biased by level.
- 2026-10-12 — D3 resolved: demand uses the **raw count** of open, uncovered necesidades, not
  a cap-saturation ratio. Rationale (user): Hornero cannot judge the importance of each
  necesidad; its knowledge is what organizaciones declare. Accepted consequence: zones with
  higher-accredited orgs (larger caps) can show more demand; document this in the map legend.

- 2026-10-12 — Scope expanded (user): ReNaCoM comedores are imported into the MS DB as
  unclaimed organizaciones (`origen=RENACOM`, new estados `SIN_RECLAMAR`/`INACTIVA`), with a
  claim flow (admin-approved) and a report flow. Proposed order: A model+import+map endpoint,
  B claim, C report, D map. Visual mockup: https://claude.ai/artifact/AnDKRdd2UXLSdkpZcC6eKN
  (pending user sign-off). Not yet re-planned into tasks.
- 2026-10-12 — Finding (mockup data prep, DuckDB dissolve of 2022 radios): 528 departamentos
  (excluding Antártida), only **155 have at least one ReNaCoM comedor**; 373 have none, so
  their deficit is undefined. Median habitantes/comedor across deptos with data: 16,655.
  The map must show "no comedores in the registry" as its own class, never as low need.

## Open decisions

- D1 — Median: city vs all radios with known population (code uses the latter). Pending user.
- D2 — Publish location of generated files: `ts_hornero_astro/public/` vs R2.
- TDD mode: unresolved (no project/session config found). Runner: `go test ./...` (worker),
  `npm run build` (astro).

## Tasks

- [x] T0 — F0 data research: Censo 2022 population per radio + geometry sources (route:
  delegated research worker; trigger: broad external research)
  - Best source: Source Cooperative `nlebovits/censo-argentino/2022` (CC-BY-4.0, INDEC +
    Rodriguez & de Grande/CONICET cartography): `census-data.parquet` (53.6 MB, `POB_TOT_P`,
    `VIV_TOT_P`, no hogares) + `radios.parquet` (62 MB geometry), join `cod_2022` = `id_geo`.
    Also `overview.pmtiles` (28 MB). https://source.coop/nlebovits/censo-argentino/2022
  - Official INDEC radio-level 2022 CSV not found; only REDATAM bases (statistical secrecy,
    Ley 17.622). Departamento totals published as XLSX (URLs not extracted).
  - Risk: radio codes/boundaries differ 2010 vs 2022; ReNaCoM vintage unknown. T1 must match
    ReNaCoM `Código de radio` against both vintages before trusting the join.
  - Departamento geometry: not verified; fallback = dissolve radios by PROV+DEPTO.
  - RENABAP verified: datos.gob.ar, CC-BY, CSV/GeoJSON/GPKG dated 2023-12-05.
- [x] T1 — Acquire population CSV `data/poblacion-radios.csv` + departamento geometry
  - Done 2026-10-12 (uncommitted): `scripts/mapa/{fetch.sh,build.sql,README.md}`,
    `make mapa-datos`, `data/poblacion-radios.csv` (66,502 rows, ~1 MB, hogares empty),
    `data/renacom-radio-2022.csv` (2,730 rows); `renacom.Cargar` auto-applies the 2022 radio
    override by Identificador, falls back to the declared code. Evidence: `go test ./...` ok
    (3 new tests), `go vet` clean, `metrics --top 10` deficit non-zero (top: La Matanza 3.29).
    No comma-decimal coordinates in renacom.csv (no rows dropped). RDD off (default).
    Departamento geometry deferred to T3 (dissolve radios). Commit: `8a8f452`.
  (route: inline, DuckDB 1.5.6 + spatial in scratchpad, nothing written to the repo yet)
  - `radios.parquet` alone suffices: 66,502 radios, `COD_2022` 9 chars, `POB_TOT_P` total
    45,618,784, `VIV_TOT_P`, geometry (CRS84). No hogares.
  - ReNaCoM `Código de radio` is NOT 2022 vintage. Point-in-polygon of all 2,730 ReNaCoM points
    against 2022 radios: 100% land in a radio; vs declared code: same province 2730, same
    departamento 2140 (78%), same fraccion 1372, same radio 594 (22%).
  - Danger: 1,729 declared codes exist in the 2022 set, but most point elsewhere — a direct
    join would silently attach the wrong population. Decision: ignore the declared code and
    derive the 2022 radio by point-in-polygon for every row.
  - 2026-10-12 decision (user): cleaning/merging runs as a **DuckDB** prep pipeline
    (`scripts/mapa/`), producing small committed CSVs the Go worker reads. Census parquet is
    cached and gitignored. Go keeps no parquet/geo dependency.
  - Implementation route: delegated writer (trigger: 2+ non-trivial files — SQL, shell,
    Makefile, Go loader + tests). TDD: no project/session config found → ordinary checks
    (`go test ./...`, `go vet ./...`, `make mapa-datos`). No commits without user permission.
  - Hornero data (orgs + open necesidades) enters as an optional input CSV in T2; fetching it
    from the MS is T4.
Re-planned 2026-10-12 after the scope expansion (unclaimed ReNaCoM organizaciones):

- [ ] A — Model + import + map endpoint (route: delegated writer; trigger: MS + BFF + admin
  types + SQL + DuckDB, 2+ non-trivial files)
  - MS: `Organizacion.origen` (`PLATAFORMA` default | `RENACOM`), `origenId` (unique),
    `asistentesDeclarados`, `codigoRadio`; `EstadoOrganizacion` += `SIN_RECLAMAR`, `INACTIVA`;
    `TipoEventoOrganizacion` += `IMPORTADA_RENACOM`.
  - `scripts/sql/V007__organizacion_origen.sql` (+ `docs/db-changes.md`, `EsquemaVerificador`).
  - `make importar-renacom`: DuckDB generates idempotent SQL (N0, no referente,
    `aceptaDonaciones=false`, one event per inserted row), applied via psql like `migrate`.
  - Public `GET /api/organizaciones/mapa` (APROBADA + SIN_RECLAMAR with coordinates) + BFF
    proxy; public slug lookup also serves SIN_RECLAMAR.
  - 2026-10-12 writer done (uncommitted): mvn test 709/0 fail; BFF 342/342 + build; admin
    build ok, vitest 460/460 with --testTimeout=30000 (2 register.test.tsx timeouts under load
    at default 5s, pass alone); astro build ok; ephemeral postgres: V007 x2 ok, import x2 →
    2,730 orgs + 2,730 events, second run +0. Extra guard: aplicarTransicion refuses
    SIN_RECLAMAR/INACTIVA. `gentle-ai review assess` returned nothing → treated high →
    independent reviewer: 0 severe, 4 medium (asignarReferente/infoPublica unguarded,
    authenticated slug 403s SIN_RECLAMAR, import identificador escaping, /mapa unprojected and
    uncached). One scoped correction round sent to the writer. Deferred to B: Astro slug page
    shows "Pendiente" pill + donate CTA for SIN_RECLAMAR.
  - Correction round done: asignarReferente/infoPublica 409 for SIN_RECLAMAR/INACTIVA,
    authenticated slug serves SIN_RECLAMAR, import restricted to numeric identificador +
    escaped + deduped + 0,0 → null, /mapa DTO projection + Cache-Control max-age=300 (MS+BFF).
    Evidence: mvn test 712/0 fail; BFF 342/342 (parent re-ran: 43/43 suites); import x2 → 2,730
    then +0. Awaiting commit permission.
- [ ] B — Claim flow: MS reclamo aggregate + endpoints, BFF, admin queue, Astro ficha + modal
- [ ] C — Report flow: MS reporte aggregate + endpoints, BFF, admin queue, Astro modal
- [ ] D — Map: depto aggregation + GeoJSON from DB data (former T2-T3), `make mapa-datos`
  publish (D2), Astro Leaflet island (former T5), docs (former T6)

Delivery: user rule — no PRs, commit only with permission, never push. Work-unit commits per
task on `feat/mapa-vulnerabilidad`.

## Acceptance criteria

- Choropleth by departamento renders nationally with diverging scale centred on 1.0.
- Heatmap weighted by asistentes, precision >= 6 excluded.
- Tooltip shows deficit, habitantesPorComedor, comedores, asistentes, habitantes.
- Visible disclaimer that the dataset is a ReNaCoM sample.
- `go test ./...`, `go vet ./...`, astro `npm run build` pass.

## Delivery

Strategy: `ask-on-risk`. Forecast: ~600-900 authored lines across T2-T5 — will exceed 400,
ask for chain strategy before crossing it.

## Progress

- 2026-10-12: design doc written; worktree created; T0 research launched.
