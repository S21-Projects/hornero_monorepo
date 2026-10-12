# Design — National Vulnerability Map

Status: **in progress** (`odd/tasks/mapa-vulnerabilidad.md`). Not implemented yet.

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
| ReNaCoM (`go_algorithms_worker/data/renacom.csv`) | 2,730 comedores/merenderos with `Código de radio`, asistentes | A sample of the registry, not the full registry |
| Censo 2022 via Source Cooperative `nlebovits/censo-argentino/2022` (CC-BY-4.0) | `POB_TOT_P` per radio + radio geometry (`radios.parquet`) | Join `cod_2022` = `id_geo`; no hogares column |
| Hornero MS | Validated organizaciones (`latitud`, `longitud`) + open necesidades | Organizaciones have no radio code |

### Cleaning and merging

1. **Re-derive every ReNaCoM radio by point-in-polygon.** ReNaCoM's `Código de radio` is not
   Censo 2022 vintage. Against the 2022 radio layer, all 2,730 points fall inside a radio, but
   the declared code matches the containing radio in only 22% of rows (same departamento 78%,
   same province 100%). Many old codes collide with different 2022 radios, so a direct code
   join would silently attach the wrong population. The declared code is ignored.
2. **Georeference precision.** ReNaCoM rows with `Tipo de georreferenciación` >= 6 (193 rows)
   are kept for their radio code but excluded from point-based rendering.
3. **Assign a radio to Hornero organizaciones** by point-in-polygon against the 2022 radio
   geometry (done in the worker batch, not in the MS).
4. **Deduplicate** Hornero organizaciones against ReNaCoM: candidate match when within a
   distance threshold and names are similar. A matched pair counts as **one** comedor.
5. **Aggregate** per radio and per departamento.

## Metric

Per zone (radio or departamento):

```
comedores            = renacom(zona) + hornero(zona) - duplicados(zona)
habitantesPorComedor = habitantes(zona) / comedores(zona)
deficitCobertura     = habitantesPorComedor / medianaNacional
necesidadesAbiertas  = raw count of open, uncovered necesidades of Hornero orgs in the zone
vulnerabilidad       = deficitCobertura * (1 + necesidadesAbiertas / comedores)
```

- **National median** (decided): every zone is compared against the median of all zones with
  known population, so any two provinces are comparable.
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

- **Country / province zoom:** choropleth by **departamento** (~530 polygons, simplified),
  diverging color scale centred on 1.0.
- **High zoom:** choropleth by **radio**.
- Comedor points (ReNaCoM + Hornero, deduplicated) as a heatmap weighted by asistentes, and
  Hornero organizaciones as clickable markers.
- Tooltip: `vulnerabilidad`, `deficitCobertura`, `habitantesPorComedor`, `comedores`,
  `necesidadesAbiertas`, `habitantes`.
- Visible disclaimer: ReNaCoM is a sample; absence of points does not mean absence of need.

Library: start with Leaflet + `leaflet.heat` (current stack). Migrate to MapLibre GL +
PMTiles only if national radio-level polygons become a requirement.

## Pipeline

The public site does not call the worker at runtime (the worker is internal-only).

```
make mapa-datos
  -> fetch census parquet (cached, gitignored) -> data/poblacion-radios.csv
  -> fetch Hornero organizaciones + open necesidades from the MS
  -> worker: merge, dedup, aggregate
  -> cobertura-departamentos.geojson, cobertura-radios (tiles or per-province files),
     comedores-heat.json
  -> published as static files
```

Hornero data changes over time, so the pipeline runs on a schedule. Ronda runs read the
same Hornero data live, so the algorithm is always current even when the map lags.

## Phases

| Task | Work |
|---|---|
| T1 | Acquire census data, build `data/poblacion-radios.csv`, verify ReNaCoM radio match rate |
| T2 | Worker: merge + dedup + per-departamento aggregation, with tests |
| T3 | Worker: GeoJSON + heat JSON output |
| T4 | `make mapa-datos` + publish location |
| T5 | Astro island: choropleth, heatmap, markers, legend, disclaimer, national view |
| T6 | Docs |

## Open questions

- Publish location of generated files: `ts_hornero_astro/public/` (rebuild) vs R2.
- Dedup distance threshold and name-similarity rule.
- RENABAP (barrios populares, datos.gob.ar, CC-BY) as an optional extra signal.

## Related

- `go_algorithms_worker/README.md`, `go_algorithms_worker/contract/ronda-v1.md`
- `docs/tesis/handoff.md` — ReNaCoM findings and algorithm model
