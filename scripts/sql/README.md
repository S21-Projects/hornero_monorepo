# Hand-written SQL scripts

This directory holds hand-run, one-off schema changes that `ddl-auto=update` cannot express
safely (Hibernate never widens a `NOT NULL` constraint to nullable, never renames a column, and
never narrows a check constraint). See `design.md` AD-13 (`openspec/changes/tesis-core-features`)
for the full rationale.

## Naming convention

`V{NNN}__{snake_case_description}.sql` — zero-padded 3-digit sequence number, double underscore,
then a short snake_case description. This mirrors Flyway's default naming convention on purpose:
if/when the project adopts Flyway as a real migration tool (tracked as a longer-term item, see
`docs/db-changes.md`), this directory can become its baseline `db/migration/` folder without
renaming anything.

## Script requirements

Every script in this directory MUST be:

- **Idempotent** — safe to run more than once without erroring or corrupting data (e.g. guard a
  `DROP NOT NULL` that may already have been applied, or use `IF NOT EXISTS` where the DDL
  supports it).
- **Transactional** — wrapped in `BEGIN; ... COMMIT;` so a mid-script failure never leaves the
  schema in a half-migrated state.
- **Reversible in principle** — even if no automated rollback script exists, the corresponding
  `docs/db-changes.md` entry must document the rollback statement.

## Run procedure

1. **Back up first.** From the repo root, on the target host:
   ```bash
   docker compose exec -T postgres pg_dump -U "$DB_USERNAME" "$DB_NAME" | gzip > backup_$(date +%F).sql.gz
   ```
2. **Run the script**, failing loudly on the first error:
   ```bash
   docker compose exec -T postgres psql -U "$DB_USERNAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
     < scripts/sql/V{NNN}__{description}.sql
   ```
3. **Verify** the change landed as expected (e.g. `\d {table}` in `psql`).
4. **Record it** in `docs/db-changes.md` (Reason / Before / Migration / After / Rollback / Applied
   to), checking off which environments it has run against.

## Why not run automatically at boot

A missing script must degrade a specific feature, never take down the whole application. Every
script in this directory has a corresponding runtime guard in the MS (see
`org.example.config.EsquemaVerificador` for `V001`) that detects the pending state and answers a
clear `503`/error for the affected feature only, instead of a raw constraint-violation `500` or
(worse) a fail-fast boot crash that would take down `DIRECTA` donations too.
