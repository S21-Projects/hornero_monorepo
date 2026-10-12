# scripts/mapa

Prepares the census data behind the vulnerability map. Run `make mapa-datos` from the
repo root.

1. `fetch.sh` downloads Censo 2022 `radios.parquet` (~65 MB) into `scripts/mapa/.cache/`
   (gitignored), only if missing. It fails on any HTTP error.
2. `build.sql` (DuckDB) writes two small CSVs, committed under `go_algorithms_worker/data/`:
   - `poblacion-radios.csv` (`codigo_radio,habitantes,hogares`): population per 2022 radio.
     `hogares` is empty because the source has no households column.
   - `renacom-radio-2022.csv` (`identificador,codigo_radio_2022`): the 2022 radio containing
     each ReNaCoM point, by point-in-polygon. `renacom.csv` itself is never modified.

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
ReNaCoM: CONICET (see `go_algorithms_worker/README.md`).

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
