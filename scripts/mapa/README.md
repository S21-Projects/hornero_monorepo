# scripts/mapa

Prepares the data behind the vulnerability map. Run `make mapa-datos` from the repo root.

1. `fetch.sh` downloads Censo 2022 `radios.parquet` (~65 MB) into `scripts/mapa/.cache/`
   (gitignored), only if missing. It fails on any HTTP error.
2. `build.sql` (DuckDB) writes two small CSVs, committed under `go_algorithms_worker/data/`:
   - `poblacion-radios.csv` (`codigo_radio,habitantes,hogares`): population per 2022 radio.
     `hogares` is empty because the source has no households column.
   - `renacom-radio-2022.csv` (`identificador,codigo_radio_2022`): the 2022 radio containing
     each ReNaCoM point, by point-in-polygon. `renacom.csv` itself is never modified.

3. `orgs.sh` stages the organizaciones input (`GET /organizaciones/mapa`) into `out/`
   (gitignored); see "Vulnerability" below.
4. `vulnerabilidad.sql` (DuckDB) joins those organizaciones to the 2022 radios and writes
   `go_algorithms_worker/data/vulnerabilidad-radios.csv` and
   `ts_hornero_astro/public/mapa/departamentos.geojson` (both committed).

## Vulnerability

Per zone (radio, departamento = `left(COD_2022, 5)`):

```
comedores            = organizaciones (APROBADA or SIN_RECLAMAR, with coordinates) in the zone
habitantesPorComedor = habitantes / comedores
deficitCobertura     = habitantesPorComedor / median over zones of the same level with comedores > 0
necesidadesAbiertas  = sum of the organizaciones' open, uncovered necesidades
vulnerabilidad       = deficitCobertura * (1 + necesidadesAbiertas / comedores)
```

The median is national and per level (radio median for the CSV, departamento median for the
GeoJSON). A zone without comedores (or without population) has `deficitCobertura` and
`vulnerabilidad` null (empty in the CSV, `null` in the GeoJSON), never 0.

Input is `MAPA_ORGS`: a local JSON file path or an `http(s)://` URL of `/organizaciones/mapa`
(the `ApiResponse` envelope or a bare array). Items need `id`, `estado`, `latitud`, `longitud`
and `necesidadesAbiertas`; other estados are ignored. The default is the committed fixture
`fixtures/organizaciones-mapa.renacom.json`: every ReNaCoM comedor as `SIN_RECLAMAR` with
`necesidadesAbiertas` 0, i.e. the state right after `make importar-renacom`. The committed
outputs are generated from it. `make mapa-fixture` rebuilds the fixture from `renacom.csv`.

```bash
make mapa-datos                                                            # fixture
MAPA_ORGS=/path/to/mapa.json make mapa-datos                               # local file
MAPA_ORGS=http://localhost:3001/organizaciones/mapa make mapa-datos        # a running local BFF
```

Pointing `MAPA_ORGS` at the production BFF is a manual, explicit operator decision; nothing in
the repo does it by default. The run is deterministic: the same input gives byte-identical files.

Outputs:

- `vulnerabilidad-radios.csv`: `codigo_radio,habitantes,comedores,necesidades_abiertas,
  deficit_cobertura,vulnerabilidad`, only radios with at least one comedor.
- `departamentos.geojson` (WGS84): one feature per departamento (Antartida excluded: centroid
  south of -56), dissolved from the radios, `ST_SimplifyPreserveTopology` 0.02 degrees and
  coordinates rounded to 4 decimals. Properties: `codigo`, `nombre` (most common ReNaCoM
  `Nombre de departamento` among its rows, empty when it has none), `provincia` (INDEC code
  table in the SQL), `habitantes`, `comedores`, `necesidadesAbiertas`, `habitantesPorComedor`,
  `deficitCobertura`, `vulnerabilidad`.

Organizaciones that fall in no radio (offshore points) are dropped. No dedup against ReNaCoM is
needed: the imported ReNaCoM comedores already are organizaciones in the MS, so the input is
the single list of comedores. `necesidadesAbiertas` counts ABIERTA and EN_PROGRESO necesidades
that are not past their `fechaVencimiento` (raw count, see `docs/mapa-vulnerabilidad.md`).

## Requirements

`duckdb` CLI (>= 1.1) with the `spatial` extension (installed on first run), and `curl`.

## Why the declared ReNaCoM code is ignored

ReNaCoM's `Código de radio` is not Censo 2022 vintage: it matches the radio that actually
contains the point in only ~22% of rows, and many old codes collide with unrelated 2022
radios. A direct join would silently attach the wrong population, so the worker prefers
`renacom-radio-2022.csv` when present.

## Source and license

Radios geometry and population: Censo Nacional de Poblacion 2022 (INDEC), cartography by
Rodriguez & de Grande (CONICET), redistributed on Source Cooperative by `nlebovits`
(`censo-argentino/2022`), CC-BY-4.0. Attribute INDEC and Rodriguez & de Grande/CONICET.
ReNaCoM: CONICET institutional repository, record hdl 11336/278030 (see `go_algorithms_worker/README.md`;
license status in `docs/mapa-vulnerabilidad.md`, "Attribution and licenses"). Both are credited on `/mapa`.

## Importing ReNaCoM into the database

`make importar-renacom` (add `ENV_FILE=.env.local` for the local stack) loads every ReNaCoM
comedor/merendero as an unclaimed organizacion so the public map can show them.

1. Prerequisites: `make migrate` (applies `scripts/sql/V007__organizacion_origen.sql`) and
   `make mapa-datos` (produces `renacom-radio-2022.csv`).
2. `importar-renacom.sql` (DuckDB) writes `scripts/mapa/out/importar-renacom.sql` (gitignored):
   one `INSERT` per row plus its `organizacion_evento`, in a single transaction.
3. The target runs `make backup`, then applies that file through `psql` (like `make migrate`).

Each row becomes: `estado=SIN_RECLAMAR`, `nivel=N0`, `validada=false`, no referente,
`acepta_donaciones=false`, `origen=RENACOM`, `origen_id=Identificador`, `asistentes_declarados`,
`codigo_radio` (2022, point-in-polygon), slug `<nombre-slugificado>-<identificador>`, and exactly one
`IMPORTADA_RENACOM` event (actor `SISTEMA`). Unparsable coordinates are stored as NULL (the row is
kept, but the map endpoint omits it).

Idempotent: `ON CONFLICT DO NOTHING` skips rows whose `origen_id`/`slug` exist, and the event is
written from that same insert's `RETURNING`, so a second run inserts 0 organizaciones and 0 events.
Rows are never updated or deleted by a re-import.
