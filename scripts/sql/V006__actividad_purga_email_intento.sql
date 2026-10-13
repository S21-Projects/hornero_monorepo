-- V006: lets the retention job clear actividad.email_intento after 90 days (N15, D12).
--
-- V004 made `actividad` immutable: UPDATE was always rejected. The data-protection policy
-- (docs/politica-datos-y-respaldo.md, 1.5) needs one exception: the email typed in a failed login
-- is set to NULL once it is 90 days old, while the row itself stays until the 365-day retention.
--
-- New rule of the trigger function (replaces V004's, same trigger):
--   * UPDATE is still rejected, EXCEPT when ALL of these hold:
--       - the transaction set `hornero.purga_actividad = 'on'` (the job does it with
--         set_config(..., true), i.e. SET LOCAL, so the permission dies with the transaction),
--       - NEW.email_intento IS NULL (the only allowed change is erasing the value),
--       - every other column is identical (compared as jsonb, so a column added later is
--         protected automatically).
--   * DELETE / TRUNCATE rules are unchanged.
--
-- Idempotent and transactional: CREATE OR REPLACE FUNCTION. Requires V004 (the trigger): aborts
-- with a clear message if it is missing. Safe to run before or after deploying the new MS image
-- (the old image never issues this UPDATE). Run procedure: scripts/sql/README.md (`make migrate`).
-- Always back up first.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'actividad_inmutable' AND NOT tgisinternal) THEN
        RAISE EXCEPTION 'actividad_inmutable trigger not found: run scripts/sql/V004__actividad_inmutable.sql first';
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION actividad_inmutable() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF coalesce(current_setting('hornero.purga_actividad', true), '') = 'on'
           AND NEW.email_intento IS NULL
           AND (to_jsonb(NEW) - 'email_intento') = (to_jsonb(OLD) - 'email_intento') THEN
            RETURN NEW;
        END IF;
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

COMMIT;
