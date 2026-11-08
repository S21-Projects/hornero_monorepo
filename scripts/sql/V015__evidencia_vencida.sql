-- V015: RN-04, evidence expiry (state VENCIDA) and its backfill.
--
-- 1. Widens the Hibernate-generated CHECK constraints (ddl-auto=update never alters them):
--      organizacion_evidencia.estado  += VENCIDA
--      organizacion_evento.tipo       += EVIDENCIA_VENCIDA
--    Pattern of V007-V009: drop any CHECK on the column that does not know the new value, then
--    recreate it with the full list. If Hibernate created no CHECK, the script just creates it.
--    The event-log trigger of V014 only fires on row UPDATE/DELETE/TRUNCATE, not on this DDL.
--
-- 2. Backfill of existing rows: every APROBADA evidence with valido_hasta NULL gets
--        valido_hasta = GREATEST(revisado_en + 1 year, CURRENT_DATE + 30 days)
--    (cargado_en when revisado_en is NULL). The floor of 30 days from the day the script runs
--    guarantees nobody is harmed instantly by the rollout: no backfilled date is earlier than the
--    deployment date plus 30 days. Rows that already have a valido_hasta are NOT touched (a
--    document that expires sooner must not be extended); the MS marks the ones already past as
--    VENCIDA on its next start, and the 30-day grace period then applies from that date.
--    The column recordatorio_vencimiento_at is added by ddl-auto=update on the MS boot.
--
-- Idempotent and transactional (a second run changes nothing: no NULL valido_hasta is left on an
-- APROBADA row, and the CHECKs already contain the new values). Run procedure: scripts/sql/README.md
-- (make migrate). Always back up first.
-- Rollback: UPDATE organizacion_evidencia SET estado = 'APROBADA' WHERE estado = 'VENCIDA';
--           then recreate the two CHECKs without the new values (only after no VENCIDA /
--           EVIDENCIA_VENCIDA row exists; events cannot be deleted, so in practice keep the CHECKs).
--           The backfilled valido_hasta values are not reversible without the backup.

BEGIN;

DO $$
DECLARE
    c RECORD;
BEGIN
    IF to_regclass('organizacion_evidencia') IS NOT NULL THEN
        FOR c IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'organizacion_evidencia'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) ~ '\mestado\M'
              AND pg_get_constraintdef(oid) NOT LIKE '%VENCIDA%'
        LOOP
            EXECUTE format('ALTER TABLE organizacion_evidencia DROP CONSTRAINT %I', c.conname);
        END LOOP;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
                       WHERE conrelid = 'organizacion_evidencia'::regclass
                         AND conname = 'organizacion_evidencia_estado_check') THEN
            ALTER TABLE organizacion_evidencia ADD CONSTRAINT organizacion_evidencia_estado_check
                CHECK (estado IN ('PENDIENTE', 'APROBADA', 'OBSERVADA', 'REEMPLAZADA', 'VENCIDA'));
        END IF;
    END IF;

    IF to_regclass('organizacion_evento') IS NOT NULL THEN
        FOR c IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'organizacion_evento'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) ~ '\mtipo\M'
              AND pg_get_constraintdef(oid) NOT LIKE '%EVIDENCIA_VENCIDA%'
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
                                'REPORTE_CONFIRMADO', 'REPORTE_DESCARTADO',
                                'EVIDENCIA_VENCIDA'));
        END IF;
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('organizacion_evidencia') IS NOT NULL THEN
        UPDATE organizacion_evidencia
           SET valido_hasta = GREATEST(
                   (COALESCE(revisado_en, cargado_en) + INTERVAL '1 year')::date,
                   CURRENT_DATE + 30)
         WHERE estado = 'APROBADA' AND valido_hasta IS NULL;
    END IF;
END
$$;

COMMIT;
