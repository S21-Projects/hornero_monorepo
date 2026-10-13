-- Generates scripts/mapa/out/importar-renacom.sql: idempotent Postgres statements that load the
-- ReNaCoM comedores/merenderos as unclaimed organizaciones (see `make importar-renacom`).
-- Run from the repo root: duckdb < scripts/mapa/importar-renacom.sql
--
-- One statement per ReNaCoM row. Re-running the generated file is a no-op: ON CONFLICT DO NOTHING
-- skips rows whose origen_id (or slug) already exists, and the IMPORTADA_RENACOM event is written
-- from the RETURNING of that same INSERT, so it exists only for rows inserted by that statement.
--
-- Requires scripts/sql/V007__organizacion_origen.sql applied and go_algorithms_worker/data/
-- renacom-radio-2022.csv (make mapa-datos). The radio comes from point-in-polygon, never from the
-- declared "Código de radio" (it is not Censo 2022 vintage, see scripts/mapa/README.md).

CREATE TEMP TABLE src AS
SELECT trim("Identificador")                                   AS identificador,
       coalesce(nullif(trim("Nombre"), ''), 'Sin nombre')      AS nombre,
       upper(trim("Tipo de organización"))                     AS tipo,
       try_cast(trim("Cantidad de asistentes") AS INTEGER)     AS asistentes,
       -- Unparsable, out-of-range or 0/0 ("null island") coordinates become NULL (row still imported).
       CASE WHEN try_cast(replace("Latitud", ',', '.') AS DOUBLE) BETWEEN -90 AND 90
             AND NOT (try_cast(replace("Latitud", ',', '.') AS DOUBLE) = 0
                      AND try_cast(replace("Longitud", ',', '.') AS DOUBLE) = 0)
            THEN try_cast(replace("Latitud", ',', '.') AS DOUBLE) END   AS latitud,
       CASE WHEN try_cast(replace("Longitud", ',', '.') AS DOUBLE) BETWEEN -180 AND 180
             AND NOT (try_cast(replace("Latitud", ',', '.') AS DOUBLE) = 0
                      AND try_cast(replace("Longitud", ',', '.') AS DOUBLE) = 0)
            THEN try_cast(replace("Longitud", ',', '.') AS DOUBLE) END  AS longitud,
       array_to_string(list_filter([
           nullif(trim(concat_ws(' ', nullif(trim("Calle"), ''), nullif(trim("Altura"), ''))), ''),
           nullif(trim("Localidad"), ''),
           nullif(trim("Municipio"), ''),
           nullif(trim("Nombre de provincia"), '')
       ], lambda x: x IS NOT NULL), ', ')                           AS direccion
FROM read_csv('go_algorithms_worker/data/renacom.csv', all_varchar = true)
WHERE regexp_matches(trim("Identificador"), '^[0-9]+$') AND upper(trim("Tipo de organización")) IN ('COMEDOR', 'MERENDERO');

-- Keep one row per identificador (the first in file order is arbitrary but stable per run).
CREATE TEMP TABLE src_unico AS
SELECT * FROM src QUALIFY row_number() OVER (PARTITION BY identificador ORDER BY nombre, tipo) = 1;

CREATE TEMP TABLE radio AS
SELECT trim(identificador) AS identificador, lpad(trim(codigo_radio_2022), 9, '0') AS codigo_radio
FROM read_csv('go_algorithms_worker/data/renacom-radio-2022.csv', all_varchar = true);

CREATE TEMP TABLE lit AS
SELECT s.identificador,
       -- single-line, quote-doubled SQL literals
       '''' || replace(regexp_replace(s.nombre, '\s+', ' ', 'g'), '''', '''''') || '''' AS nombre_l,
       '''' || trim(both '-' FROM regexp_replace(
                    regexp_replace(lower(strip_accents(s.nombre)), '[^a-z0-9]+', '-', 'g'), '-+', '-', 'g'))
            || '-' || replace(s.identificador, '''', '''''') || '''' AS slug_l,
       '''' || s.tipo || '''' AS tipo_l,
       coalesce('''' || replace(regexp_replace(s.direccion, '\s+', ' ', 'g'), '''', '''''') || '''', 'NULL') AS direccion_l,
       coalesce(CAST(s.latitud AS VARCHAR), 'NULL') AS lat_l,
       coalesce(CAST(s.longitud AS VARCHAR), 'NULL') AS lon_l,
       coalesce(CAST(s.asistentes AS VARCHAR), 'NULL') AS asist_l,
       coalesce('''' || r.codigo_radio || '''', 'NULL') AS radio_l,
       '''' || replace(s.identificador, '''', '''''') || '''' AS id_l
FROM src_unico s
LEFT JOIN radio r USING (identificador);

COPY (
  SELECT stmt FROM (
  SELECT 0 AS ord, '' AS k, 'BEGIN;' AS stmt
  UNION ALL
  SELECT 1, identificador, 'WITH ins AS (INSERT INTO organizaciones (nombre, slug, tipo, direccion, latitud, longitud, '
      || 'validada, estado, nivel, referente_id, acepta_donaciones, origen, origen_id, '
      || 'asistentes_declarados, codigo_radio, version) VALUES ('
      || nombre_l || ', ' || slug_l || ', ' || tipo_l || ', ' || direccion_l || ', ' || lat_l || ', ' || lon_l
      || ', false, ''SIN_RECLAMAR'', ''N0'', NULL, false, ''RENACOM'', ' || id_l || ', ' || asist_l || ', '
      || radio_l || ', 0) ON CONFLICT DO NOTHING RETURNING id) '
      || 'INSERT INTO organizacion_evento (organizacion_id, tipo, ocurrido_en, actor_tipo, nivel_despues, motivo) '
      || 'SELECT id, ''IMPORTADA_RENACOM'', now(), ''SISTEMA'', ''N0'', ''Importada desde ReNaCoM (id '
      || replace(identificador, '''', '''''') || ')'' FROM ins;'
  FROM lit
  UNION ALL
  SELECT 2, '', 'COMMIT;'
  ) ORDER BY ord, try_cast(k AS BIGINT), k
) TO 'scripts/mapa/out/importar-renacom.sql' (FORMAT csv, HEADER false, QUOTE '', ESCAPE '', DELIMITER '|');
