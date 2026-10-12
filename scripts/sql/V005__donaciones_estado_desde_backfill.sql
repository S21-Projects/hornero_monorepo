-- V005: backfill donaciones.estado_desde (N12, D4).
--
-- `estado_desde` (when a donacion entered its current estado) is added by the MS through
-- ddl-auto=update as a NULLABLE column, so every pre-existing row is NULL. The stale-donations job
-- and the admin "estancada" flag treat NULL as the start of `fecha_oferta` (Buenos Aires) at read
-- time, so nothing breaks before this script runs; this makes the fallback explicit in the data.
-- Best available value: the real moment of the last transition was never recorded.
--
-- Idempotent and transactional: only touches rows that are still NULL. Requires the column
-- (created by the MS on first boot with this release): aborts with a clear message if missing.
-- Run procedure: see scripts/sql/README.md (use `make migrate`). Always back up first.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'donaciones' AND column_name = 'estado_desde') THEN
        RAISE EXCEPTION 'donaciones.estado_desde not found: start the MS once (ddl-auto=update creates it), then re-run';
    END IF;
END
$$;

UPDATE donaciones
   SET estado_desde = (fecha_oferta::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
 WHERE estado_desde IS NULL
   AND fecha_oferta IS NOT NULL;

COMMIT;
