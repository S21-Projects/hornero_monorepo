-- V010: drop the redundant UNIQUE constraint on organizaciones.origen_id.
--
-- The entity used to declare `unique = true` on origen_id, so Hibernate (ddl-auto=update) created a
-- generated constraint (uk_<hash>) next to the partial unique index ux_organizaciones_origen_id from
-- V007. The partial index is the single source of truth (idempotency key of
-- scripts/mapa/importar-renacom.sql, ON CONFLICT DO NOTHING); this script drops the duplicate.
--
-- The constraint is found by its column (a UNIQUE whose only column is origen_id), not by name, because
-- the generated name differs between databases. ux_organizaciones_origen_id is an index, not a
-- constraint, so it is never touched.
--
-- Idempotent and transactional. Run procedure: see scripts/sql/README.md (use `make migrate`).
-- Always back up first.

BEGIN;

DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        WHERE con.conrelid = 'organizaciones'::regclass
          AND con.contype = 'u'
          AND con.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a
                                  WHERE a.attrelid = con.conrelid AND a.attname = 'origen_id')]
    LOOP
        EXECUTE format('ALTER TABLE organizaciones DROP CONSTRAINT %I', c.conname);
    END LOOP;
END
$$;

COMMIT;
