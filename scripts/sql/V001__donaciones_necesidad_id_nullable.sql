-- V001: allow fondo común donations without a necesidad (tesis-core-features slice 5b).
--
-- Idempotent and transactional: safe to run more than once (DROP NOT NULL on an already-nullable
-- column is a no-op) and safe to run before the new MS image is deployed (the old code never
-- writes NULL into this column, so existing rows and existing app behavior are unaffected).
--
-- Run procedure: see scripts/sql/README.md and docs/deploy-rpi-cloudflare.md's
-- "Pre-deploy: pool schema migration (slice 5b)" step. Always back up first.

BEGIN;

ALTER TABLE donaciones ALTER COLUMN necesidad_id DROP NOT NULL;

COMMIT;
