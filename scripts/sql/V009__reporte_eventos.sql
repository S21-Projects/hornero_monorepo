-- V009: report-flow events on the organizacion audit trail.
--
-- Widens the Hibernate-generated CHECK constraint on organizacion_evento.tipo (ddl-auto=update never
-- alters it) so it also accepts REPORTE_CONFIRMADO and REPORTE_DESCARTADO. The new table of the report
-- flow (reportes_organizacion) is created by ddl-auto=update.
--
-- Also creates the partial unique index ux_reporte_pendiente: one PENDIENTE report per
-- (organizacion, reportante). It is skipped while the table does not exist yet (ddl-auto creates it
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
              AND pg_get_constraintdef(oid) NOT LIKE '%REPORTE_CONFIRMADO%'
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
                                'RECLAMO_APROBADO', 'RECLAMO_RECHAZADO',
                                'REPORTE_CONFIRMADO', 'REPORTE_DESCARTADO'));
        END IF;
    END IF;
END
$$;

-- One PENDIENTE report per (organizacion, reportante). Rows already violating it (none expected: the
-- service refuses duplicates) must be resolved by hand before the index can be built.
DO $$
BEGIN
    IF to_regclass('reportes_organizacion') IS NOT NULL THEN
        CREATE UNIQUE INDEX IF NOT EXISTS ux_reporte_pendiente
            ON reportes_organizacion (organizacion_id, reportante_id) WHERE estado = 'PENDIENTE';
    END IF;
END
$$;

COMMIT;
