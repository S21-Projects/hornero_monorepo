-- V003: initialise the @Version (optimistic locking) columns of donaciones, necesidades and
-- organizaciones (N11).
--
-- ddl-auto=update adds `version` as a nullable column; existing rows would stay NULL and every
-- update to them would fail the version check. This script creates the column when missing (safe
-- before the new MS image has ever booted), sets 0 on NULL rows, then makes it NOT NULL DEFAULT 0.
--
-- Idempotent and transactional: ADD COLUMN IF NOT EXISTS, UPDATE ... WHERE version IS NULL and
-- SET NOT NULL / SET DEFAULT are all no-ops on a second run. Safe to run before or after deploying
-- the new image. Run procedure: see scripts/sql/README.md (use `make migrate`). Always back up first.

BEGIN;

ALTER TABLE donaciones     ADD COLUMN IF NOT EXISTS version BIGINT;
ALTER TABLE necesidades    ADD COLUMN IF NOT EXISTS version BIGINT;
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS version BIGINT;

UPDATE donaciones     SET version = 0 WHERE version IS NULL;
UPDATE necesidades    SET version = 0 WHERE version IS NULL;
UPDATE organizaciones SET version = 0 WHERE version IS NULL;

ALTER TABLE donaciones     ALTER COLUMN version SET DEFAULT 0;
ALTER TABLE necesidades    ALTER COLUMN version SET DEFAULT 0;
ALTER TABLE organizaciones ALTER COLUMN version SET DEFAULT 0;

ALTER TABLE donaciones     ALTER COLUMN version SET NOT NULL;
ALTER TABLE necesidades    ALTER COLUMN version SET NOT NULL;
ALTER TABLE organizaciones ALTER COLUMN version SET NOT NULL;

COMMIT;
