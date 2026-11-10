-- Builds the radios asset the worker's POST /v1/radio looks points up in.
-- Run from the repo root (see `make mapa-radios`): duckdb < scripts/mapa/radios.sql
--
-- One NDJSON line per Censo 2022 radio, gzipped: {"c":"<9-digit code>","g":<GeoJSON Polygon|MultiPolygon>}.
-- Geometries are simplified so the file stays small enough to commit; the worker tolerates the gaps
-- this opens between neighbours with a near-miss fallback (go_algorithms_worker/internal/radios).
-- Tolerances are in degrees. Simplifying at 0.0001 (about 10 m) gave an 11.3 MB asset, over the 10 MB
-- size gate documented in scripts/mapa/README.md, so this uses 0.0002 (about 20 m): 8.7 MB.
INSTALL spatial;
LOAD spatial;

COPY (
  SELECT lpad(COD_2022, 9, '0') AS c,
         ST_AsGeoJSON(ST_ReducePrecision(
             ST_SimplifyPreserveTopology(geometry::GEOMETRY, 0.0002), 0.00001))::JSON AS g
  FROM read_parquet('scripts/mapa/.cache/radios.parquet')
  ORDER BY 1
) TO 'go_algorithms_worker/data/radios-2022.ndjson.gz' (FORMAT json, COMPRESSION gzip);
