-- V013: at most one active assignment per donation (RN-08, no double reassignment).
--
-- Partial unique index on asignaciones (donacion_id) WHERE estado = 'PROPUESTA'. PROPUESTA is the
-- "vigente" assignment: the one DonacionService resolves to ACEPTADA / RECHAZADA / CANCELADA
-- (AsignacionRepository#findFirstByDonacion_IdAndEstadoOrderByCreadaEnDesc). ACEPTADA is left out
-- on purpose: an admin override can leave an ACEPTADA row behind while the donation returns to the
-- pool, and the next ronda would then legitimately propose it again; indexing ACEPTADA would turn
-- that into a constraint violation that rolls back a whole ronda.
--
-- Does NOT delete or modify data. If any donation already has more than one PROPUESTA row the
-- script aborts with the offending donation ids and changes nothing; resolve those by hand
-- (set the stale rows to CANCELADA) and run it again.
--
-- Skipped while the asignaciones table does not exist yet (ddl-auto=update creates it when the new
-- MS image first boots), so re-run `make migrate` after that first boot; EsquemaVerificador reports
-- the index as pending until then.
--
-- Idempotent and transactional. Run procedure: see scripts/sql/README.md (use `make migrate`).
-- Always back up first.

BEGIN;

DO $$
DECLARE
    duplicadas text;
BEGIN
    IF to_regclass('asignaciones') IS NULL THEN
        RAISE NOTICE 'V013 skipped: table asignaciones does not exist yet; boot the MS once and re-run make migrate';
        RETURN;
    END IF;

    SELECT string_agg(donacion_id || ' (' || filas || ' rows)', ', ' ORDER BY donacion_id)
      INTO duplicadas
      FROM (SELECT donacion_id, count(*) AS filas
              FROM asignaciones
             WHERE estado = 'PROPUESTA'
             GROUP BY donacion_id
            HAVING count(*) > 1
             ORDER BY donacion_id
             LIMIT 50) d;

    IF duplicadas IS NOT NULL THEN
        RAISE EXCEPTION 'V013 aborted, nothing changed: donacion_id with more than one PROPUESTA asignacion: %. '
                        'Set the stale rows to CANCELADA by hand and run this script again.', duplicadas;
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS ux_asignacion_activa_por_donacion
        ON asignaciones (donacion_id) WHERE estado = 'PROPUESTA';
END
$$;

COMMIT;
