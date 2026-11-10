-- V012: index on organizaciones (latitud, longitud), for the public map viewport query
-- (GET /api/organizaciones/mapa/zona, OrganizacionRepository#findMapaEnCaja).
--
-- Additive and perf-only: no schema shape change, so the MS works (slower) before it runs and
-- EsquemaVerificador has no check. Idempotent and transactional. Run procedure: see
-- scripts/sql/README.md (use `make migrate`). Always back up first.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_organizaciones_lat_lng ON organizaciones (latitud, longitud);

COMMIT;
