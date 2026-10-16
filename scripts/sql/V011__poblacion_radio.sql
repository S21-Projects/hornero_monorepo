-- V011: population per 2022 census radio, the denominator of the live ronda vulnerability.
--
-- Additive: creates one table and touches no existing one. Loaded by `make importar-poblacion`
-- (scripts/mapa/importar-poblacion.sh), read by the MS at ronda time (PoblacionRadioRepository).
-- An empty or missing table never breaks a ronda: every candidate degrades to a NEUTRAL deficit.
--
-- Idempotent and transactional. Run procedure: see scripts/sql/README.md (use `make migrate`).
-- Always back up first.

BEGIN;

CREATE TABLE IF NOT EXISTS poblacion_radio (
    codigo_radio varchar(9) PRIMARY KEY,
    habitantes   integer    NOT NULL CHECK (habitantes >= 0)
);

COMMIT;
