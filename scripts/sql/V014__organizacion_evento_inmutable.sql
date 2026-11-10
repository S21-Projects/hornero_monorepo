-- V014: database-level immutability of the accreditation event log (C4).
--
-- organizacion_evento is append-only in the application (no setters, insert-only repository) and,
-- since C4, hash-chained (prev_hash / hash, see docs/tfg/seguridad-c4.md). This adds the same
-- guarantee inside PostgreSQL against ad-hoc SQL:
--
--   1. A trigger rejects every UPDATE, DELETE and TRUNCATE, for every role, superusers included
--      (triggers fire for them too). The single exception is the one-time sealing of a legacy row:
--      an UPDATE that takes a row with hash IS NULL AND prev_hash IS NULL to non-null values and
--      changes nothing else. That is what the MS startup backfill does, so the backfill keeps
--      working before or after this script, in either order.
--   2. REVOKE DELETE, TRUNCATE (and UPDATE, see below) from PUBLIC and from the role running this
--      script, when that role is not a superuser.
--
-- WHAT THIS DOES NOT PROTECT (do not claim otherwise):
--   * The MS connects as the role that owns the table (ddl-auto=update creates the tables with it).
--     An owner can GRANT the privileges back to itself and can DROP or DISABLE the trigger.
--   * With the default docker-compose the MS role is the POSTGRES_USER, a superuser: privilege
--     checks do not apply to it at all, so the REVOKE is a no-op for it (the script says so). Only
--     the trigger acts, and a superuser can drop it.
--   So the real tamper evidence is the hash chain plus the anchors in the bucket, not this script.
--   A role that is not the owner and holds only SELECT, INSERT would be a real barrier, but it needs
--   ddl-auto=update replaced by hand-run migrations (see docs/tfg/seguridad-c4.md, "Limits").
--
-- REVOKE UPDATE is applied only if no legacy row is still unsealed (it would block the sealing
-- UPDATE for a non-superuser owner). If rows are pending, the script says so: start the MS once so
-- the backfill seals them, then run this script again.
--
-- Idempotent and transactional. Requires the table and the chain columns, which the MS creates with
-- ddl-auto=update on its first boot with the C4 code: the script aborts with a clear message
-- otherwise. Run procedure: scripts/sql/README.md (make migrate). Always back up first.
-- Rollback: DROP TRIGGER organizacion_evento_inmutable ON organizacion_evento;
--           DROP TRIGGER organizacion_evento_inmutable_truncate ON organizacion_evento;
--           GRANT UPDATE, DELETE, TRUNCATE ON organizacion_evento TO <app role>;

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.organizacion_evento') IS NULL THEN
        RAISE EXCEPTION 'organizacion_evento table not found: start the MS once (ddl-auto=update creates it), then re-run';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organizacion_evento' AND column_name = 'hash') THEN
        RAISE EXCEPTION 'organizacion_evento.hash not found: start the MS with the C4 code once (ddl-auto=update adds the chain columns), then re-run';
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION organizacion_evento_inmutable() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.hash IS NULL AND OLD.prev_hash IS NULL
       AND NEW.hash IS NOT NULL AND NEW.prev_hash IS NOT NULL
       AND (to_jsonb(NEW) - 'hash' - 'prev_hash') = (to_jsonb(OLD) - 'hash' - 'prev_hash') THEN
        RETURN NEW; -- one-time sealing of a legacy row by the hash chain backfill
    END IF;
    RAISE EXCEPTION 'organizacion_evento es inmutable: % no esta permitido', TG_OP
        USING ERRCODE = 'restrict_violation';
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizacion_evento_inmutable ON organizacion_evento;
CREATE TRIGGER organizacion_evento_inmutable
    BEFORE UPDATE OR DELETE ON organizacion_evento
    FOR EACH ROW EXECUTE FUNCTION organizacion_evento_inmutable();

DROP TRIGGER IF EXISTS organizacion_evento_inmutable_truncate ON organizacion_evento;
CREATE TRIGGER organizacion_evento_inmutable_truncate
    BEFORE TRUNCATE ON organizacion_evento
    FOR EACH STATEMENT EXECUTE FUNCTION organizacion_evento_inmutable();

REVOKE UPDATE, DELETE, TRUNCATE ON organizacion_evento FROM PUBLIC;

DO $$
BEGIN
    IF (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
        RAISE NOTICE 'V014: % is a superuser, so privilege checks do not apply to it and REVOKE changes nothing for it; the trigger is the active protection', current_user;
        RETURN;
    END IF;
    EXECUTE format('REVOKE DELETE, TRUNCATE ON organizacion_evento FROM %I', current_user);
    IF EXISTS (SELECT 1 FROM organizacion_evento WHERE hash IS NULL) THEN
        RAISE NOTICE 'V014: UPDATE not revoked yet: legacy rows are still unsealed. Start the MS (it seals them) and re-run this script';
    ELSE
        EXECUTE format('REVOKE UPDATE ON organizacion_evento FROM %I', current_user);
        RAISE NOTICE 'V014: UPDATE, DELETE and TRUNCATE revoked from %; the owner can still grant them back to itself', current_user;
    END IF;
END
$$;

COMMIT;
