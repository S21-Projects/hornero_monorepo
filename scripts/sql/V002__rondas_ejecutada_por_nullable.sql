-- V002: allow scheduled (AUTOMATICA) rondas, which have no executing user (N7).
--
-- Idempotent and transactional: DROP NOT NULL on an already-nullable column is a no-op, and the
-- old MS code always writes a user id, so running this before deploying the new image is safe.
-- The new `origen` column is added by ddl-auto=update (default 'MANUAL' for existing rows).
--
-- Run procedure: see scripts/sql/README.md (use `make migrate`). Always back up first.

BEGIN;

ALTER TABLE rondas ALTER COLUMN ejecutada_por DROP NOT NULL;

COMMIT;
