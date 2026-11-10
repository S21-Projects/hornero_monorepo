-- Generates scripts/mapa/fixtures/organizaciones-mapa.renacom.json: a stand-in for the response of
-- GET /organizaciones/mapa (same envelope and item shape) built from ReNaCoM alone, i.e. the state
-- right after `make importar-renacom`: every comedor SIN_RECLAMAR, necesidadesAbiertas 0.
-- Run from the repo root: make mapa-fixture   (duckdb < scripts/mapa/fixture.sql)
--
-- It mirrors the filters of importar-renacom.sql (COMEDOR/MERENDERO, numeric Identificador, one row
-- per Identificador, unparsable or 0/0 coordinates dropped because the endpoint omits rows without
-- coordinates). ids are a stable 1..n over Identificador, since the real ids are database-assigned.

CREATE TEMP TABLE src AS
SELECT trim("Identificador")                               AS identificador,
       coalesce(nullif(trim("Nombre"), ''), 'Sin nombre')  AS nombre,
       upper(trim("Tipo de organización"))                 AS tipo,
       try_cast(replace("Latitud", ',', '.') AS DOUBLE)    AS lat,
       try_cast(replace("Longitud", ',', '.') AS DOUBLE)   AS lng
FROM read_csv('go_algorithms_worker/data/renacom.csv', all_varchar = true)
WHERE regexp_matches(trim("Identificador"), '^[0-9]+$')
  AND upper(trim("Tipo de organización")) IN ('COMEDOR', 'MERENDERO');

CREATE TEMP TABLE items AS
SELECT row_number() OVER (ORDER BY try_cast(identificador AS BIGINT)) AS id, *
FROM (
  SELECT * FROM src
  WHERE lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180 AND NOT (lat = 0 AND lng = 0)
  QUALIFY row_number() OVER (PARTITION BY identificador ORDER BY nombre, tipo) = 1
);

-- Envelope = ApiResponse (status, message, timestamp, data, errors). The timestamp is a constant so
-- regenerating the fixture is byte-stable. One item per line keeps diffs reviewable.
COPY (
  SELECT '{"status":200,"message":"Success","timestamp":"2026-01-01T00:00:00Z","errors":null,"data":['
         || chr(10)
         || string_agg(
              json_object(
                'id', id,
                'slug', trim(both '-' FROM regexp_replace(
                          regexp_replace(lower(strip_accents(nombre)), '[^a-z0-9]+', '-', 'g'), '-+', '-', 'g'))
                        || '-' || identificador,
                'nombre', regexp_replace(nombre, '\s+', ' ', 'g'),
                'tipo', tipo,
                'estado', 'SIN_RECLAMAR',
                'origen', 'RENACOM',
                'latitud', lat,
                'longitud', lng,
                'necesidadesAbiertas', 0
              )::VARCHAR, ',' || chr(10) ORDER BY id)
         || chr(10) || ']}'
  FROM items
) TO 'scripts/mapa/fixtures/organizaciones-mapa.renacom.json' (FORMAT csv, HEADER false, QUOTE '', ESCAPE '', DELIMITER '\t');
