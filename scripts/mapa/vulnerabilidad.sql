-- Vulnerability metric per radio and per departamento (see docs/mapa-vulnerabilidad.md).
-- Run from the repo root after scripts/mapa/orgs.sh (see `make mapa-datos`):
--   duckdb < scripts/mapa/vulnerabilidad.sql
--
-- Inputs : scripts/mapa/out/organizaciones-mapa.json  (GET /organizaciones/mapa, staged by orgs.sh)
--          scripts/mapa/.cache/radios.parquet          (Censo 2022 radios, fetch.sh)
--          go_algorithms_worker/data/renacom.csv + renacom-radio-2022.csv (departamento names only)
-- Outputs: go_algorithms_worker/data/vulnerabilidad-radios.csv
--          ts_hornero_astro/public/mapa/departamentos.geojson
--
--   comedores            = organizaciones (APROBADA or SIN_RECLAMAR, with coordinates) in the zone
--   habitantesPorComedor = habitantes / comedores
--   deficitCobertura     = habitantesPorComedor / median(habitantesPorComedor over zones of the same
--                          level with comedores > 0)                       (national median)
--   necesidadesAbiertas  = sum of the organizaciones' open, uncovered necesidades
--   vulnerabilidad       = deficitCobertura * (1 + necesidadesAbiertas / comedores)
-- A zone with no comedores (or no population) has deficit and vulnerabilidad NULL, never 0.
INSTALL spatial;
LOAD spatial;

CREATE TEMP TABLE radios AS
SELECT lpad(COD_2022, 9, '0') AS codigo_radio,
       POB_TOT_P AS habitantes,
       geometry::GEOMETRY AS geom
FROM read_parquet('scripts/mapa/.cache/radios.parquet');

-- The file is the API envelope ({"data": [...]}) or a bare array of items.
CREATE TEMP TABLE orgs AS
WITH raw AS (
  SELECT content::JSON AS j FROM read_text('scripts/mapa/out/organizaciones-mapa.json')
), items AS (
  SELECT unnest(from_json(CASE WHEN json_type(j) = 'ARRAY' THEN j ELSE j -> 'data' END, '["JSON"]')) AS o
  FROM raw
)
SELECT try_cast(o ->> 'id' AS BIGINT)                          AS id,
       try_cast(o ->> 'latitud' AS DOUBLE)                     AS lat,
       try_cast(o ->> 'longitud' AS DOUBLE)                    AS lng,
       greatest(coalesce(try_cast(o ->> 'necesidadesAbiertas' AS BIGINT), 0), 0) AS necesidades
FROM items
WHERE o ->> 'estado' IN ('APROBADA', 'SIN_RECLAMAR')
  AND try_cast(o ->> 'latitud' AS DOUBLE) BETWEEN -90 AND 90
  AND try_cast(o ->> 'longitud' AS DOUBLE) BETWEEN -180 AND 180
  AND NOT (try_cast(o ->> 'latitud' AS DOUBLE) = 0 AND try_cast(o ->> 'longitud' AS DOUBLE) = 0)
QUALIFY row_number() OVER (PARTITION BY id ORDER BY id) = 1;

-- Point-in-polygon to the 2022 radio. A point on a shared boundary matches two radios: keep the
-- lowest code for determinism. Points outside every radio (offshore) are dropped.
CREATE TEMP TABLE org_radio AS
SELECT o.id, o.necesidades, min(r.codigo_radio) AS codigo_radio
FROM orgs o
JOIN radios r ON ST_Contains(r.geom, ST_Point(o.lng, o.lat))
GROUP BY o.id, o.necesidades;

-- ---- per radio ------------------------------------------------------------------------------
CREATE TEMP TABLE radio_agg AS
SELECT oradio.codigo_radio,
       r.habitantes,
       count(*)                  AS comedores,
       sum(oradio.necesidades)   AS necesidades,
       CASE WHEN r.habitantes > 0 THEN r.habitantes::DOUBLE / count(*) END AS hpc
FROM org_radio oradio
JOIN radios r USING (codigo_radio)
GROUP BY oradio.codigo_radio, r.habitantes;

CREATE TEMP TABLE mediana_radio AS SELECT median(hpc) AS m FROM radio_agg WHERE hpc IS NOT NULL;

COPY (
  SELECT a.codigo_radio,
         a.habitantes,
         a.comedores,
         a.necesidades AS necesidades_abiertas,
         round(a.hpc / m.m, 6) AS deficit_cobertura,
         round(a.hpc / m.m * (1 + a.necesidades::DOUBLE / a.comedores), 6) AS vulnerabilidad
  FROM radio_agg a, mediana_radio m
  ORDER BY a.codigo_radio
) TO 'go_algorithms_worker/data/vulnerabilidad-radios.csv' (HEADER, DELIMITER ',');

-- ---- per departamento ------------------------------------------------------------------------
CREATE TEMP TABLE depto_geo AS
SELECT left(codigo_radio, 5) AS codigo,
       sum(habitantes)::BIGINT AS habitantes,
       ST_Union_Agg(geom) AS geom
FROM radios
GROUP BY 1;

CREATE TEMP TABLE depto_com AS
SELECT left(codigo_radio, 5) AS codigo, count(*) AS comedores, sum(necesidades)::BIGINT AS necesidades
FROM org_radio
GROUP BY 1;

-- Most common ReNaCoM "Nombre de departamento" among the rows that fall in the departamento
-- (ties: alphabetical). Departamentos with no ReNaCoM row keep an empty name.
CREATE TEMP TABLE depto_nombre AS
SELECT codigo, nombre FROM (
  SELECT left(rr.codigo_radio_2022, 5) AS codigo,
         trim(rc."Nombre de departamento") AS nombre,
         row_number() OVER (PARTITION BY left(rr.codigo_radio_2022, 5)
                            ORDER BY count(*) DESC, trim(rc."Nombre de departamento")) AS pos
  FROM read_csv('go_algorithms_worker/data/renacom.csv', all_varchar = true) rc
  JOIN read_csv('go_algorithms_worker/data/renacom-radio-2022.csv', all_varchar = true) rr
    ON trim(rc."Identificador") = trim(rr.identificador)
  WHERE trim(rc."Nombre de departamento") <> ''
  GROUP BY 1, 2
) WHERE pos = 1;

-- Province names by INDEC code (24 jurisdictions; stable, so no census download for it).
CREATE TEMP TABLE provincia AS
SELECT * FROM (VALUES
  ('02', 'Ciudad Autónoma de Buenos Aires'), ('06', 'Buenos Aires'), ('10', 'Catamarca'),
  ('14', 'Córdoba'), ('18', 'Corrientes'), ('22', 'Chaco'), ('26', 'Chubut'), ('30', 'Entre Ríos'),
  ('34', 'Formosa'), ('38', 'Jujuy'), ('42', 'La Pampa'), ('46', 'La Rioja'), ('50', 'Mendoza'),
  ('54', 'Misiones'), ('58', 'Neuquén'), ('62', 'Río Negro'), ('66', 'Salta'), ('70', 'San Juan'),
  ('74', 'San Luis'), ('78', 'Santa Cruz'), ('82', 'Santa Fe'), ('86', 'Santiago del Estero'),
  ('90', 'Tucumán'), ('94', 'Tierra del Fuego')
) AS t(codigo, nombre);

-- Antártida (centroid south of -56) is not drawn: it would stretch the national view.
CREATE TEMP TABLE depto AS
SELECT g.codigo,
       coalesce(n.nombre, '')            AS nombre,
       coalesce(p.nombre, '')            AS provincia,
       g.habitantes,
       coalesce(c.comedores, 0)          AS comedores,
       coalesce(c.necesidades, 0)        AS necesidades,
       CASE WHEN g.habitantes > 0 AND c.comedores > 0 THEN g.habitantes::DOUBLE / c.comedores END AS hpc,
       ST_ReducePrecision(ST_SimplifyPreserveTopology(g.geom, 0.02), 0.0001) AS geom
FROM depto_geo g
LEFT JOIN depto_com c USING (codigo)
LEFT JOIN depto_nombre n USING (codigo)
LEFT JOIN provincia p ON p.codigo = left(g.codigo, 2)
WHERE ST_Y(ST_Centroid(g.geom)) >= -56;

CREATE TEMP TABLE mediana_depto AS SELECT median(hpc) AS m FROM depto WHERE hpc IS NOT NULL;

COPY (
  SELECT json_object(
           'type', 'FeatureCollection',
           'features', to_json(list(
             json_object(
               'type', 'Feature',
               'properties', json_object(
                 'codigo', d.codigo,
                 'nombre', d.nombre,
                 'provincia', d.provincia,
                 'habitantes', d.habitantes,
                 'comedores', d.comedores,
                 'necesidadesAbiertas', d.necesidades,
                 'habitantesPorComedor', round(d.hpc, 2),
                 'deficitCobertura', round(d.hpc / m.m, 4),
                 'vulnerabilidad', round(d.hpc / m.m * (1 + d.necesidades::DOUBLE / d.comedores), 4)),
               'geometry', ST_AsGeoJSON(d.geom)::JSON)
             ORDER BY d.codigo)))::VARCHAR
  FROM depto d, mediana_depto m
) TO 'ts_hornero_astro/public/mapa/departamentos.geojson' (FORMAT csv, HEADER false, QUOTE '', ESCAPE '', DELIMITER '\t');

-- ---- summary (stdout) ------------------------------------------------------------------------
SELECT (SELECT count(*) FROM orgs)                                   AS orgs_leidas,
       (SELECT count(*) FROM org_radio)                              AS orgs_con_radio,
       (SELECT count(*) FROM radio_agg)                              AS radios_con_comedores,
       (SELECT count(*) FILTER (WHERE hpc IS NOT NULL) FROM radio_agg) AS radios_con_vulnerabilidad,
       (SELECT m FROM mediana_radio)                                 AS mediana_hpc_radios,
       (SELECT count(*) FROM depto)                                  AS departamentos,
       (SELECT count(*) FILTER (WHERE hpc IS NOT NULL) FROM depto)   AS deptos_con_vulnerabilidad,
       (SELECT m FROM mediana_depto)                                 AS mediana_hpc_deptos;
