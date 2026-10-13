# Design — National Vulnerability Map

Status: **in progress** (`odd/tasks/mapa-vulnerabilidad.md`). Data pipeline, worker integration and the `/mapa` page (Astro + Leaflet) are implemented; radio-level polygons at high zoom are not.

## Goal

A national map of Argentina that shows **vulnerable zones**, computed from one combined
dataset: the ReNaCoM comedor registry, Censo 2022 population, and the data Hornero itself
collects (organizaciones and their open necesidades). The same number feeds the `deficit`
term of the ronda score, so the map explains where the assignment algorithm sends pooled
donations.

## Key concept: coverage plus declared demand

A heatmap of comedor locations does **not** show vulnerability: many comedores in an area
can mean high need or need already covered. Vulnerability combines two signals:

1. **Coverage** — how many people each comedor serves in the zone.
2. **Declared demand** — how many open, uncovered necesidades Hornero organizaciones in the
   zone have published.

## Data sources (combined, not separate layers)

| Source | Provides | Notes |
|---|---|---|
| ReNaCoM (`go_algorithms_worker/data/renacom.csv`), CONICET institutional repository [hdl 11336/278030](https://ri.conicet.gov.ar/handle/11336/278030) | 2,730 comedores/merenderos with `Código de radio`, asistentes | A sample of the registry, not the full registry. License: see "Attribution and licenses" |
| Censo 2022 via Source Cooperative `nlebovits/censo-argentino/2022` (CC-BY-4.0) | `POB_TOT_P` per radio + radio geometry (`radios.parquet`) | Join `cod_2022` = `id_geo`; no hogares column |
| Hornero MS | Validated organizaciones (`latitud`, `longitud`) + open necesidades | Organizaciones have no radio code |

### Attribution and licenses

- **Censo 2022 (INDEC) + radio cartography by Rodriguez & de Grande (CONICET): CC-BY-4.0.**
  Credited on `/mapa` (sources paragraph under the map, `MapaVulnerabilidad.tsx`) with a link to
  the license and a note that Hornero processed the data.
- **ReNaCoM (CONICET):** credited on `/mapa` with a link to the repository record. **The exact
  license of the record is not yet recorded here**: the repository was unreachable on 2026-10-13.
  Copy the license shown on the record page (and its recommended citation) into this line and,
  if it is not CC-BY, review the `/mapa` wording.

### Cleaning and merging

1. **Re-derive every ReNaCoM radio by point-in-polygon.** ReNaCoM's `Código de radio` is not
   Censo 2022 vintage. Against the 2022 radio layer, all 2,730 points fall inside a radio, but
   the declared code matches the containing radio in only 22% of rows (same departamento 78%,
   same province 100%). Many old codes collide with different 2022 radios, so a direct code
   join would silently attach the wrong population. The declared code is ignored.
2. **Georeference precision.** ReNaCoM rows with `Tipo de georreferenciación` >= 6 (193 rows)
   are kept for their radio code but excluded from point-based rendering.
3. **Assign a radio to every organizacion** (ReNaCoM-imported and Hornero) by point-in-polygon
   against the 2022 radio geometry, in the DuckDB pipeline (`scripts/mapa/vulnerabilidad.sql`).
4. **No dedup step.** ReNaCoM comedores are imported into the MS as `SIN_RECLAMAR`
   organizaciones, so the organizaciones list is already the single list of comedores.
5. **Aggregate** per radio and per departamento.

## Metric

Per zone (radio or departamento):

```
comedores            = organizaciones (APROBADA + SIN_RECLAMAR, with coordinates) in the zone
habitantesPorComedor = habitantes(zona) / comedores(zona)
deficitCobertura     = habitantesPorComedor / medianaNacional
necesidadesAbiertas  = raw count of open, uncovered necesidades of those organizaciones
vulnerabilidad       = deficitCobertura * (1 + necesidadesAbiertas / comedores)
```

- **National median** (decided): every zone is compared against the median of the zones of the
  same level (radio or departamento) with comedores, so any two provinces are comparable.
- **Zones with no comedores** have `deficitCobertura` and `vulnerabilidad` null ("sin comedores
  en el registro"), never 0.
- **Raw count** of necesidades (decided): Hornero cannot judge the importance of each
  necesidad; it relies on what organizaciones declare. Accepted bias: open-necesidad caps
  depend on accreditation level (N0/N1/N2/N3 = 0/3/6/12, `AcreditacionProperties`), so zones
  with higher-accredited orgs can show more demand. The map legend states this.
- The demand multiplier is 1 when a zone has no Hornero necesidades: absence of Hornero data
  is neutral, never treated as low need.
- The multiplier form is a first proposal and is expected to be tuned.

`vulnerabilidad` replaces the current per-radio `deficit` input of the ronda score
(`go_algorithms_worker/internal/assign/scoring.go`, weight 0.35).

## Rendering

Implemented in `ts_hornero_astro/src/pages/mapa.astro` with the islands
`MapaVulnerabilidad.tsx` (panel, legend, info card) and `MapaVulnerabilidadMap.tsx` (Leaflet):

- **Choropleth by departamento** from the static `public/mapa/departamentos.geojson`, diverging
  6-step scale centred on 1.0. Departamentos without comedores render muted gray with a dashed
  outline ("Sin comedores en el registro"), never as low need.
- **Pins** fetched at runtime from the BFF `GET /organizaciones/mapa`: Hornero organizaciones
  (filled) and unclaimed ReNaCoM comedores (outlined), with popups linking to `/org/{slug}`.
  If the BFF is unreachable the choropleth still renders.
- **Density layer** (off by default): large translucent circle markers that accumulate where
  comedores cluster. `leaflet.heat` was rejected (unmaintained since 2016, no types). Points
  are not weighted by asistentes because the map endpoint does not carry them.
- **Info card** per departamento: vulnerabilidad, habitantes, comedores, habitantes por
  comedor, necesidades sin cubrir. A "Ir a un departamento" select gives keyboard access.
- Visible disclaimer: ReNaCoM is a sample; absence of points does not mean absence of need;
  higher-accredited organizaciones can show more necesidades because their cap is larger.
- **Not built:** radio-level polygons at high zoom (~66k radios). Revisit with MapLibre GL +
  PMTiles if that becomes a requirement.

## Pipeline

The public site does not call the worker at runtime (the worker is internal-only). The data is
precomputed offline and committed:

```
make mapa-datos                      (see scripts/mapa/README.md)
  fetch.sh      -> Censo 2022 radios.parquet (cached, gitignored)
  build.sql     -> data/poblacion-radios.csv, data/renacom-radio-2022.csv
  orgs.sh       -> stages MAPA_ORGS (JSON file or http(s) URL of GET /organizaciones/mapa;
                   default: the committed ReNaCoM fixture) into scripts/mapa/out/
  vulnerabilidad.sql (DuckDB)
                -> point-in-polygon of each organizacion to its 2022 radio
                -> go_algorithms_worker/data/vulnerabilidad-radios.csv
                -> ts_hornero_astro/public/mapa/departamentos.geojson
```

- **Open, uncovered necesidades.** `GET /organizaciones/mapa` carries `necesidadesAbiertas` per
  organizacion: the count of its necesidades in `ABIERTA` or `EN_PROGRESO` that are not past their
  `fechaVencimiento` (computed in the same projection query, no N+1). Those are the states that
  count against the accreditation caps and that a ronda can still fill; `CUMPLIDA` and `VENCIDA`
  are excluded. Unclaimed ReNaCoM comedores always report 0.
- **One list of comedores.** ReNaCoM comedores are already organizaciones in the MS
  (`SIN_RECLAMAR`), so the pipeline reads a single list and the earlier "dedup Hornero against
  ReNaCoM" step is not needed: a claimed comedor stays one organizacion.
- **Committed outputs come from the fixture** (`scripts/mapa/fixtures/organizaciones-mapa.renacom.json`,
  rebuilt with `make mapa-fixture`), so they show pure coverage deficit (`vulnerabilidad` = `deficitCobertura`).
  Refreshing them with real Hornero demand is `MAPA_ORGS=http://localhost:3001/organizaciones/mapa make mapa-datos`
  against a BFF the operator chooses; pointing it at production is a manual, explicit decision.
- **Fixture run:** 2,730 organizaciones, all in a 2022 radio; 2,002 radios with comedores; 528
  departamentos (Antartida excluded), 155 with comedores (the other 373 have null deficit and
  vulnerabilidad); national median 16,655 habitantes per comedor across those departamentos
  (819.5 across radios); GeoJSON 449 KB.
- **Ronda score.** When `vulnerabilidad-radios.csv` is next to `renacom.csv`, the worker uses a
  radio's `vulnerabilidad` for the score's deficit term, with the existing precedence and
  normalization; an empty value falls through to CERCANO / NEUTRAL (see `go_algorithms_worker/README.md`).

Hornero data changes over time, so the files are regenerated on demand. Ronda runs read the
worker's committed CSV, so it lags the live data until it is regenerated and redeployed.

## Phases

| Task | Work |
|---|---|
| T1 | Acquire census data, build `data/poblacion-radios.csv`, verify ReNaCoM radio match rate |
| T2 | Aggregation per radio and departamento (DuckDB, `vulnerabilidad.sql`) |
| T3 | Worker: GeoJSON + heat JSON output |
| T4 | `make mapa-datos` + publish location |
| T5 | Astro island: choropleth, heatmap, markers, legend, disclaimer, national view |
| T6 | Docs |

## Open questions

- Publish location of generated files: `ts_hornero_astro/public/` (rebuild) vs R2.
- RENABAP (barrios populares, datos.gob.ar, CC-BY) as an optional extra signal.

## Related

- `go_algorithms_worker/README.md`, `go_algorithms_worker/contract/ronda-v1.md`
- `docs/tesis/handoff.md` — ReNaCoM findings and algorithm model
