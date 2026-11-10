-- V004: database-level immutability of the activity log (M6, N10).
--
-- The application already treats `actividad` as append-only (immutable entity, insert-only
-- repository). This adds the same guarantee inside PostgreSQL, so it also holds against ad-hoc
-- SQL by anyone who is not the table owner / a superuser:
--   * UPDATE is always rejected.
--   * DELETE and TRUNCATE are rejected unless the transaction set
--     `hornero.purga_actividad = 'on'` (ActividadRetencionJob does this with
--     set_config(..., true), i.e. SET LOCAL, so the permission dies with the transaction).
--
-- Limit: the table owner or a superuser can still DROP the trigger. A truly insert-only role
-- would be the next step (see docs/registro-actividades.md).
--
-- Idempotent and transactional: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS / CREATE
-- TRIGGER are safe to re-run. Requires the `actividad` table (created by the MS via
-- ddl-auto=update on first boot): the script aborts with a clear message if it is missing.
-- Run procedure: see scripts/sql/README.md (use `make migrate`). Always back up first.

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.actividad') IS NULL THEN
        RAISE EXCEPTION 'actividad table not found: start the MS once (ddl-auto=update creates it), then re-run';
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION actividad_inmutable() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'actividad es inmutable: no se permite UPDATE'
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF coalesce(current_setting('hornero.purga_actividad', true), '') = 'on' THEN
        IF TG_OP = 'TRUNCATE' THEN
            RETURN NULL;
        END IF;
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'actividad es inmutable: % solo se permite en la purga por retención', TG_OP
        USING ERRCODE = 'restrict_violation';
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS actividad_inmutable ON actividad;
CREATE TRIGGER actividad_inmutable
    BEFORE UPDATE OR DELETE ON actividad
    FOR EACH ROW EXECUTE FUNCTION actividad_inmutable();

DROP TRIGGER IF EXISTS actividad_inmutable_truncate ON actividad;
CREATE TRIGGER actividad_inmutable_truncate
    BEFORE TRUNCATE ON actividad
    FOR EACH STATEMENT EXECUTE FUNCTION actividad_inmutable();

COMMIT;
