-- Builds the two CSVs the Go worker reads from the Censo 2022 radios parquet.
-- Run from the repo root (see `make mapa-datos`): duckdb < scripts/mapa/build.sql
INSTALL spatial;
LOAD spatial;

CREATE TEMP TABLE radios AS
SELECT COD_2022 AS codigo_radio,
       POB_TOT_P AS habitantes,
       geometry::GEOMETRY AS geom
FROM read_parquet('scripts/mapa/.cache/radios.parquet');

-- Population per radio. The census has no households column, so hogares stays empty
-- (the worker's loader treats it as 0); never substitute viviendas for it.
COPY (
  SELECT lpad(codigo_radio, 9, '0') AS codigo_radio,
         habitantes,
         NULL::INTEGER AS hogares
  FROM radios
  ORDER BY 1
) TO 'go_algorithms_worker/data/poblacion-radios.csv' (HEADER, DELIMITER ',');

-- The declared ReNaCoM "Código de radio" is not Censo 2022 vintage, so the 2022 radio is
-- derived from each point instead. Some exports use comma decimals in lat/lng.
CREATE TEMP TABLE puntos AS
SELECT try_cast("Identificador" AS BIGINT) AS identificador,
       try_cast(replace("Longitud", ',', '.') AS DOUBLE) AS lng,
       try_cast(replace("Latitud", ',', '.') AS DOUBLE) AS lat
FROM read_csv('go_algorithms_worker/data/renacom.csv', all_varchar = true);

COPY (
  -- A point on a shared boundary can match two radios: keep the lowest code for determinism.
  SELECT p.identificador,
         lpad(min(r.codigo_radio), 9, '0') AS codigo_radio_2022
  FROM puntos p
  JOIN radios r ON ST_Contains(r.geom, ST_Point(p.lng, p.lat))
  WHERE p.identificador IS NOT NULL
  GROUP BY p.identificador
  ORDER BY p.identificador
) TO 'go_algorithms_worker/data/renacom-radio-2022.csv' (HEADER, DELIMITER ',');
