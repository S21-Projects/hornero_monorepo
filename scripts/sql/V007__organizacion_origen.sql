-- V007: external-registry provenance for organizaciones (ReNaCoM import).
--
-- * adds organizaciones.origen / origen_id / asistentes_declarados / codigo_radio when missing
--   (ddl-auto=update would add them too; creating them here makes the script safe to run before the
--   new MS image has ever booted);
-- * widens the Hibernate-generated CHECK constraints that ddl-auto=update never alters:
--     organizaciones.estado       += SIN_RECLAMAR, INACTIVA
--     organizaciones.origen       (new column) PLATAFORMA, RENACOM
--     organizacion_evento.tipo    += IMPORTADA_RENACOM
-- * unique partial index on origen_id (idempotency key of scripts/mapa/importar-renacom.sql).
--
-- Idempotent and transactional. Run procedure: see scripts/sql/README.md (use `make migrate`).
-- Always back up first.

BEGIN;

ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS origen VARCHAR(255);
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS origen_id VARCHAR(255);
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS asistentes_declarados INTEGER;
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS codigo_radio VARCHAR(9);

DO $$
DECLARE
    c RECORD;
BEGIN
    -- organizaciones.estado: drop any CHECK on `estado` that does not know the new values.
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'organizaciones'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ~ '\mestado\M'
          AND pg_get_constraintdef(oid) NOT LIKE '%SIN_RECLAMAR%'
    LOOP
        EXECUTE format('ALTER TABLE organizaciones DROP CONSTRAINT %I', c.conname);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'organizaciones'::regclass AND conname = 'organizaciones_estado_check') THEN
        ALTER TABLE organizaciones ADD CONSTRAINT organizaciones_estado_check
            CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'SIN_RECLAMAR', 'INACTIVA'));
    END IF;

    -- organizaciones.origen: a CHECK Hibernate may have generated for the new column.
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'organizaciones'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ~ '\morigen\M'
          AND pg_get_constraintdef(oid) NOT LIKE '%RENACOM%'
    LOOP
        EXECUTE format('ALTER TABLE organizaciones DROP CONSTRAINT %I', c.conname);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'organizaciones'::regclass AND conname = 'organizaciones_origen_check') THEN
        ALTER TABLE organizaciones ADD CONSTRAINT organizaciones_origen_check
            CHECK (origen IN ('PLATAFORMA', 'RENACOM'));
    END IF;

    -- organizacion_evento.tipo (skipped if the audit table does not exist yet: ddl-auto creates it
    -- with the full enum on first boot).
    IF to_regclass('organizacion_evento') IS NOT NULL THEN
        FOR c IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'organizacion_evento'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) ~ '\mtipo\M'
              AND pg_get_constraintdef(oid) NOT LIKE '%IMPORTADA_RENACOM%'
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
                                'REFERENTE_REASIGNADO', 'IMPORTADA_RENACOM'));
        END IF;
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_organizaciones_origen_id
    ON organizaciones (origen_id) WHERE origen_id IS NOT NULL;

COMMIT;
