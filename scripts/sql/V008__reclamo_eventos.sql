-- V008: claim-flow events on the organizacion audit trail.
--
-- Widens the Hibernate-generated CHECK constraint on organizacion_evento.tipo (ddl-auto=update never
-- alters it) so it also accepts RECLAMO_APROBADO and RECLAMO_RECHAZADO. The new tables of the claim
-- flow (reclamos_organizacion, reclamo_organizacion_evidencias) are created by ddl-auto=update.
--
-- Also creates the partial unique index ux_reclamo_pendiente: one PENDIENTE claim per
-- (organizacion, referente). It is skipped while the table does not exist yet (ddl-auto creates it
-- when the new MS image first boots), so re-run `make migrate` after that first boot; the script is
-- idempotent and EsquemaVerificador reports the index as pending until then.
--
-- Idempotent and transactional. Run procedure: see scripts/sql/README.md (use `make migrate`).
-- Always back up first.

BEGIN;

DO $$
DECLARE
    c RECORD;
BEGIN
    IF to_regclass('organizacion_evento') IS NOT NULL THEN
        FOR c IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'organizacion_evento'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) ~ '\mtipo\M'
              AND pg_get_constraintdef(oid) NOT LIKE '%RECLAMO_APROBADO%'
        LOOP
            EXECUTE format('ALTER TABLE organizacion_evento DROP CONSTRAINT %I', c.conname);
        END LOOP;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
                       WHERE conrelid = 'organizacion_evento'::regclass
                         AND conname = 'organizacion_evento_tipo_check') THEN
            ALTER TABLE organizacion_evento ADD CONSTRAINT organizacion_evento_tipo_check
                CHECK (tipo IN ('MIGRACION_INICIAL', 'ORGANIZACION_REGISTRADA', 'REGISTRO_RECHAZADO',
                                'EVIDENCIA_ADJUNTADA', 'EVIDENCIA_REEMPLAZADA', 'REQUISITO_APROBADO',
                                'REQUISITO_OBSERVADO', 'NIVEL_ELEVADO', 'NIVEL_REDUCIDO',
                                'REFERENTE_REASIGNADO', 'IMPORTADA_RENACOM',
                                'RECLAMO_APROBADO', 'RECLAMO_RECHAZADO'));
        END IF;
    END IF;
END
$$;

-- One PENDIENTE claim per (organizacion, referente). Rows already violating it (none expected: the
-- service refuses duplicates) must be resolved by hand before the index can be built.
DO $$
BEGIN
    IF to_regclass('reclamos_organizacion') IS NOT NULL THEN
        CREATE UNIQUE INDEX IF NOT EXISTS ux_reclamo_pendiente
            ON reclamos_organizacion (organizacion_id, referente_id) WHERE estado = 'PENDIENTE';
    END IF;
END
$$;

COMMIT;
