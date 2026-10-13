# Manual DB Changes Log

`spring.jpa.hibernate.ddl-auto=update` auto-creates tables and columns, but it
**never alters an existing CHECK constraint** — those have to be dropped and
recreated by hand. This file tracks every manual change so it survives a
restart/reinstall and doesn't live only in chat history.

Each entry below must be run **once per environment** (local dev DB, Pi
production DB) — check the "Applied to" line before running anything twice.

---

## 2026-10-13 — `organizaciones.origen_id`: drop the redundant UNIQUE constraint (P6)

**Reason**: `Organizacion.origenId` declared `unique = true`, so `ddl-auto=update` generated a `uk_<hash>` UNIQUE constraint next to the partial unique index `ux_organizaciones_origen_id` from V007. The partial index is the single source of truth (idempotency key of `scripts/mapa/importar-renacom.sql`); the entity no longer declares `unique = true`.

**Before**: both `uk_<hash> UNIQUE (origen_id)` and `ux_organizaciones_origen_id` exist.

**Migration**: `scripts/sql/V010__organizaciones_origen_id_unique_dedup.sql` (run `make migrate`). Looks the constraint up in `pg_constraint` by column (the generated name varies per database) and drops it; the partial index is untouched. Safe before or after deploying the new MS image, and re-runnable. Cleanup only: nothing breaks if it is pending, so `EsquemaVerificador` has no check for it.

**After**: only `ux_organizaciones_origen_id` enforces uniqueness of `origen_id` (NULLs allowed, as before).

**Rollback**: `ALTER TABLE organizaciones ADD CONSTRAINT uk_organizaciones_origen_id UNIQUE (origen_id);` (only to restore the old duplicate; not needed).

**Applied to**:
- [ ] Local dev DB
- [ ] Pi production DB

---

## 2026-10-13 — `organizacion_evento_tipo_check`: report-flow events (mapa-vulnerabilidad, task C)

**Reason**: confirming or discarding a report on an unclaimed organizacion writes `TipoEventoOrganizacion.REPORTE_CONFIRMADO` / `REPORTE_DESCARTADO` to the audit trail. `ddl-auto=update` never widens the CHECK it generated for the STRING enum, so inserting them would fail. The new table `reportes_organizacion` is created by `ddl-auto=update` (no script needed).

**Before**: `organizacion_evento_tipo_check` lacks `REPORTE_CONFIRMADO` and `REPORTE_DESCARTADO`.

**Migration**: `scripts/sql/V009__reporte_eventos.sql` (run `make migrate`, then restart the MS). Drops any CHECK on `tipo` that lacks the new values and recreates it with the full list (V008 values included). Safe before or after deploying the new MS image, and re-runnable. It also builds the partial unique index `ux_reporte_pendiente` on `reportes_organizacion (organizacion_id, reportante_id) WHERE estado = 'PENDIENTE'` (one pending report per user and comedor, even under a race). That table only exists after the new MS image first boots, so **run `make migrate` again after that first boot** (idempotent). At boot `EsquemaVerificador` logs `ESQUEMA_PENDIENTE` while the stale CHECK or the index is missing (PostgreSQL only); until then confirming/discarding a report fails with a constraint violation (409 CONFLICTO_DATOS).

**After**: `organizacion_evento.tipo` accepts the two report events.

**Rollback**: `DELETE FROM organizacion_evento WHERE tipo IN ('REPORTE_CONFIRMADO','REPORTE_DESCARTADO');` then recreate the V008 check (without the two values) and `DROP INDEX IF EXISTS ux_reporte_pendiente;`. The report table can stay; the old code ignores it.

**Applied to**:
- [ ] Local dev DB
- [ ] Pi production DB

---

## 2026-10-13 — `organizacion_evento_tipo_check`: claim-flow events (mapa-vulnerabilidad, task B)

**Reason**: approving or rejecting a claim on an unclaimed organizacion writes `TipoEventoOrganizacion.RECLAMO_APROBADO` / `RECLAMO_RECHAZADO` to the audit trail. `ddl-auto=update` never widens the CHECK it generated for the STRING enum, so inserting them would fail. The new tables `reclamos_organizacion` and `reclamo_organizacion_evidencias` are created by `ddl-auto=update` (no script needed).

**Before**: `organizacion_evento_tipo_check` lacks `RECLAMO_APROBADO` and `RECLAMO_RECHAZADO`.

**Migration**: `scripts/sql/V008__reclamo_eventos.sql` (run `make migrate`, then restart the MS). Drops any CHECK on `tipo` that lacks the new values and recreates it with the full list. Safe before or after deploying the new MS image, and re-runnable. It also builds the partial unique index `ux_reclamo_pendiente` on `reclamos_organizacion (organizacion_id, referente_id) WHERE estado = 'PENDIENTE'` (one pending claim per referente and comedor, even under a race). That table only exists after the new MS image first boots, so **run `make migrate` again after that first boot** (idempotent). At boot `EsquemaVerificador` logs `ESQUEMA_PENDIENTE` while the stale CHECK or the index is missing (PostgreSQL only); until then approving/rejecting a claim fails with a constraint violation (409 CONFLICTO_DATOS).

**After**: `organizacion_evento.tipo` accepts the two claim events.

**Rollback**: `DELETE FROM organizacion_evento WHERE tipo IN ('RECLAMO_APROBADO','RECLAMO_RECHAZADO');` then recreate the V007 check (without the two values) and `DROP INDEX IF EXISTS ux_reclamo_pendiente;`. The claim tables can stay; the old code ignores them.

**Applied to**:
- [ ] Local dev DB
- [ ] Pi production DB

---

## 2026-10-12 — `organizaciones`: provenance columns + widened `estado` / event `tipo` checks (mapa-vulnerabilidad, task A)

**Reason**: ReNaCoM comedores are imported as unclaimed organizaciones. That adds `EstadoOrganizacion.SIN_RECLAMAR` / `INACTIVA`, `TipoEventoOrganizacion.IMPORTADA_RENACOM`, the `OrigenOrganizacion` enum and four columns. `ddl-auto=update` adds columns but never widens the CHECK constraints it generated for STRING enums, so inserting the new values would fail.

**Before**: `organizaciones_estado_check` allows PENDIENTE/APROBADA/RECHAZADA; `organizacion_evento_tipo_check` lacks `IMPORTADA_RENACOM`; no `origen`, `origen_id`, `asistentes_declarados`, `codigo_radio`.

**Migration**: `scripts/sql/V007__organizacion_origen.sql` (run `make migrate`). Adds the columns if missing, drops any CHECK on those columns that lacks the new values and recreates it, creates the partial unique index `ux_organizaciones_origen_id`. Safe before or after deploying the new MS image. At boot `EsquemaVerificador` logs `ESQUEMA_PENDIENTE` while a stale CHECK remains (PostgreSQL only). The rows themselves come from `make importar-renacom` (see `scripts/mapa/README.md`), a separate step.

**After**: `organizaciones.estado` accepts SIN_RECLAMAR/INACTIVA; `organizacion_evento.tipo` accepts IMPORTADA_RENACOM; `origen` is NULL/`PLATAFORMA` for existing rows (read as PLATAFORMA).

**Rollback**: delete imported rows first (`DELETE FROM organizacion_evento WHERE tipo = 'IMPORTADA_RENACOM'; DELETE FROM organizaciones WHERE origen = 'RENACOM';`), then `DROP INDEX ux_organizaciones_origen_id;` and recreate the narrower checks if wanted. The columns can stay; the old code ignores them.

**Applied to**:
- [ ] Local dev DB
- [ ] Pi production DB

---

## 2026-10-13 — `actividad` trigger lets the retention job clear `email_intento` (N15, D12)

**Reason**: the data-protection policy (`docs/politica-datos-y-respaldo.md`, 1.5) limits the email typed in failed logins to 90 days, but V004 rejected every UPDATE on `actividad`. The row (who, when, what, IP) stays until the 365-day retention; only the email is erased.

**Before**: `actividad_inmutable()` rejected every UPDATE.

**Migration**: `scripts/sql/V006__actividad_purga_email_intento.sql` (run `make migrate`; needs V004). Replaces the trigger function (the triggers are untouched). UPDATE is still rejected unless all hold: the transaction set `hornero.purga_actividad = 'on'`, `NEW.email_intento IS NULL`, and every other column is identical (`to_jsonb(NEW) - 'email_intento' = to_jsonb(OLD) - 'email_intento'`, so columns added later are protected without touching the script). DELETE/TRUNCATE rules are unchanged. `EmailIntentoPurgaJob` opens the window with `set_config(..., true)` (= `SET LOCAL`) in its own transaction. Safe to run before or after deploying the new MS image. Until it runs, the job logs the failure and `EsquemaVerificador` logs `ESQUEMA_PENDIENTE` at boot (PostgreSQL only); nothing else is affected.

**After**: same triggers, new function body.

**Rollback**: re-apply `scripts/sql/V004__actividad_inmutable.sql` (restores the function that rejects every UPDATE).

**Applied to**: local dev DB (2026-10-13; verified in psql: UPDATE of `email_intento` without the setting fails, with it succeeds, any other column change fails even with it). Pi production: pending (`make migrate` after deploy).

---

## 2026-10-12 — Backfill `donaciones.estado_desde` (N12, D4)

**Reason**: the stale-donations job and the admin "estancada" flag need to know when a donation entered its current estado. `Donacion.estadoDesde` is stamped on every transition from now on; `ddl-auto=update` adds the column as nullable, so existing rows are NULL.

**Before**: no `estado_desde` column.

**Migration**: `scripts/sql/V005__donaciones_estado_desde_backfill.sql` (run `make migrate`, then restart the MS). Sets `estado_desde` to the start of `fecha_oferta` (Buenos Aires) where it is NULL; best available value, since the real moment of the last transition was never recorded. Optional for correctness: while rows are NULL the job and the flag use that same fallback at read time. At boot `EsquemaVerificador` logs `ESQUEMA_PENDIENTE` if NULL rows remain (PostgreSQL only). Idempotent.

**After**: `donaciones.estado_desde TIMESTAMP` populated for every row with a `fecha_oferta`.

**Rollback**: nothing to undo for correctness; `UPDATE donaciones SET estado_desde = NULL;` restores the pre-script state (the fallback keeps working). The column can stay, the old code ignores it.

**Applied to**:
- [ ] Local dev DB
- [ ] Pi production DB (`make migrate` after deploying)

---

## 2026-10-12 — Immutability trigger on `actividad` (M6, N10)

**Reason**: the activity log is append-only for the application (immutable entity, insert-only repository) but nothing stopped ad-hoc SQL from editing or deleting rows. A trigger now enforces it inside PostgreSQL.

**Before**: no trigger on `actividad`.

**Migration**: `scripts/sql/V004__actividad_inmutable.sql` (run `make migrate`; needs the `actividad` table, i.e. the MS must have booted once). Creates `actividad_inmutable()` plus a row-level `BEFORE UPDATE OR DELETE` and a statement-level `BEFORE TRUNCATE` trigger. UPDATE is always rejected; DELETE/TRUNCATE are rejected unless the transaction set `hornero.purga_actividad = 'on'`, which `ActividadRetencionJob` does with `set_config(..., true)` (= `SET LOCAL`) as the first statement of its transaction. Safe to run before or after deploying the new MS image (the old image's purge job would fail until the new image is up, which only delays retention). At boot `EsquemaVerificador` logs `ESQUEMA_PENDIENTE` if the trigger is missing (PostgreSQL only). Limit: the table owner or a superuser can still drop the trigger.

**After**: triggers `actividad_inmutable` and `actividad_inmutable_truncate` on `actividad`.

**Rollback**: `DROP TRIGGER actividad_inmutable ON actividad; DROP TRIGGER actividad_inmutable_truncate ON actividad; DROP FUNCTION actividad_inmutable();`

**Applied to**: local dev DB (2026-10-12). Pi production: pending (`make migrate` after deploy).

---

## 2026-10-10 — `version` columns for optimistic locking on `donaciones`, `necesidades`, `organizaciones` (N11)

**Reason**: `@Version` on `Donacion`, `Necesidad` and `Organizacion` makes two concurrent operations on the same row safe: the first commit wins, the second answers 409 `CONFLICTO_CONCURRENTE`. `ddl-auto=update` adds the column as nullable and leaves existing rows NULL, which would make every later update of those rows fail the version check.

**Before**: no `version` column.

**Migration**: `scripts/sql/V003__optimistic_version_columns.sql` (run `make migrate`). Adds the column if missing, sets `0` where NULL, then `DEFAULT 0 NOT NULL`. Safe before or after deploying the new MS image. At boot `EsquemaVerificador` logs `ESQUEMA_PENDIENTE` if NULL versions remain (PostgreSQL only). The new `idempotency_keys` table is created by `ddl-auto=update` (no script needed).

**After**: `version BIGINT NOT NULL DEFAULT 0` on the three tables.

**Rollback**: `ALTER TABLE donaciones ALTER COLUMN version DROP NOT NULL;` (same for the other two); the column can stay, the old code ignores it.

**Applied to**:
- [ ] Local dev DB
- [ ] Pi production DB (run `make migrate` right after deploying, before traffic)

---

## 2026-10-10 — `rondas.ejecutada_por`: drop NOT NULL for scheduled rondas (N7)

**Reason**: the optional scheduled ronda (`RONDAS_AUTO_ENABLED=true`) has no executing user.

**Before**: `rondas.ejecutada_por BIGINT NOT NULL`.

**Migration**: `scripts/sql/V002__rondas_ejecutada_por_nullable.sql` (run `make migrate`). The new `rondas.origen` column (default `MANUAL`) is created by `ddl-auto=update`.

**After**: `ejecutada_por` is nullable; automatic rondas store NULL and `origen = 'AUTOMATICA'`.

**Rollback**: `UPDATE rondas SET ejecutada_por = <admin id> WHERE ejecutada_por IS NULL; ALTER TABLE rondas ALTER COLUMN ejecutada_por SET NOT NULL;`

**Applied to**:
- [ ] Local dev DB
- [ ] Pi production DB (only needed before enabling `RONDAS_AUTO_ENABLED`)

---

## 2026-09-30 — `donaciones.necesidad_id`: drop NOT NULL for fondo común donations

**Reason**: `tesis-core-features` slice 5b introduces `FONDO_COMUN` donations, which are created
without a target `necesidad` and wait unassigned in a pool until a ronda matches them to one
(`specs/donacion-fondo-comun/spec.md`). `ddl-auto=update` never widens an existing `NOT NULL`
constraint, so this must be run by hand — see `scripts/sql/V001__donaciones_necesidad_id_nullable.sql`
and `scripts/sql/README.md` for the run procedure and rationale (AD-13,
`openspec/changes/tesis-core-features/design.md`).

**Before**:
```
Column       | Type   | Nullable
necesidad_id | bigint | not null
```

**Migration** (`scripts/sql/V001__donaciones_necesidad_id_nullable.sql`, idempotent/transactional):
```sql
BEGIN;
ALTER TABLE donaciones ALTER COLUMN necesidad_id DROP NOT NULL;
COMMIT;
```

**After** (verify with `\d donaciones` in psql):
```
Column       | Type   | Nullable
necesidad_id | bigint |
```

**Rollback** (only safe if no `FONDO_COMUN` donation with `necesidad_id IS NULL` exists yet):
```sql
ALTER TABLE donaciones ALTER COLUMN necesidad_id SET NOT NULL;
```

**Runtime guard**: `org.example.config.EsquemaVerificador` checks this column at boot
(PostgreSQL only, skipped on H2). If it is still `NOT NULL`, it logs an `ERROR` naming this script
and `POST /api/donaciones` with `modalidad=FONDO_COMUN` answers `503 ESQUEMA_PENDIENTE` instead of
a raw constraint-violation `500`. `DIRECTA` donations are unaffected either way.

**Applied to**:
- [x] Local dev DB (`make up-local` / `docker compose up`, H2 in tests doesn't need this at all —
  entity-driven `create-drop` already reflects `nullable = true`) — verified by the full MS test
  suite (`DonacionRepositoryTest`, `EsquemaVerificadorTest`, `DonacionServiceTest`) passing against
  H2 with the relaxed entity mapping.
- [ ] Pi production DB — **not yet run**. Must run before this slice's MS image is deployed, per
  `docs/deploy-rpi-cloudflare.md`'s "Pre-deploy: pool schema migration (slice 5b)" step, otherwise
  every `FONDO_COMUN` creation request will answer `503 ESQUEMA_PENDIENTE` (safe degradation, not
  an outage — `DIRECTA` keeps working).

---

## 2026-07-30 — `donaciones_estado_check`: add lifecycle states

**Reason**: `sdd/donation-lifecycle` change adds three new `EstadoDonacion`
values (`ACEPTADA`, `RECHAZADA`, `PENDIENTE_CONFIRMACION`) to support the
offer → accept/reject → mutual delivery confirmation flow. The old CHECK
constraint only allowed `OFRECIDA`, `EN_CAMINO`, `ENTREGADA`, `CANCELADA`, so
inserting/updating a row to any of the new states fails at the DB level even
though the Java enum and Hibernate mapping already accept them.

**Before**:
```sql
"donaciones_estado_check" CHECK (estado::text = ANY (ARRAY['OFRECIDA'::character varying, 'EN_CAMINO'::character varying, 'ENTREGADA'::character varying, 'CANCELADA'::character varying]::text[]))
```

**Migration**:
```sql
ALTER TABLE donaciones DROP CONSTRAINT donaciones_estado_check;
ALTER TABLE donaciones ADD CONSTRAINT donaciones_estado_check
  CHECK (estado::text = ANY (ARRAY['OFRECIDA','ACEPTADA','RECHAZADA','EN_CAMINO','PENDIENTE_CONFIRMACION','ENTREGADA','CANCELADA']::text[]));
```

**After** (verify with `\d donaciones` in psql):
```sql
"donaciones_estado_check" CHECK (estado::text = ANY (ARRAY['OFRECIDA'::text, 'ACEPTADA'::text, 'RECHAZADA'::text, 'EN_CAMINO'::text, 'PENDIENTE_CONFIRMACION'::text, 'ENTREGADA'::text, 'CANCELADA'::text]))
```

**Rollback** (if ever needed — only safe if no row uses a new state):
```sql
ALTER TABLE donaciones DROP CONSTRAINT donaciones_estado_check;
ALTER TABLE donaciones ADD CONSTRAINT donaciones_estado_check
  CHECK (estado::text = ANY (ARRAY['OFRECIDA','EN_CAMINO','ENTREGADA','CANCELADA']::text[]));
```

**Applied to**:
- [x] Local dev DB (`make up-local`, container `hornero_app-postgres-1`, DB `hornero`, user `hornero`) — ran 2026-07-30, verified existing rows (3 OFRECIDA, 3 EN_CAMINO, 3 ENTREGADA) still satisfy the new constraint.
- [ ] Pi production DB — **not yet run**. Must run before the `donation-lifecycle` code ships to production, otherwise any request that transitions a donation into `ACEPTADA`/`RECHAZADA`/`PENDIENTE_CONFIRMACION` will fail with a DB constraint violation (500).

**How to run it on the Pi**: SSH in, then
```bash
docker exec -it <postgres-container-name> psql -U hornero -d hornero
```
and paste the migration block above. Confirm with `\d donaciones` that the
constraint matches the "After" block, then check existing row states don't
violate it (`SELECT estado, COUNT(*) FROM donaciones GROUP BY estado;` should
only show values from the old set, which are all still legal in the new one).

---

## Template for the next entry

```md
## YYYY-MM-DD — `<table>_<column>_check` (or whatever changed): <one-line reason>

**Reason**: ...

**Before**: ...

**Migration**: ...

**After**: ...

**Rollback**: ...

**Applied to**:
- [ ] Local dev DB — ...
- [ ] Pi production DB — ...
```

---

## Longer-term note

This log is a stopgap, not a real solution — `ddl-auto=update` with hand-run
`ALTER`s doesn't scale past a couple of changes and has no automatic
enforcement (nothing stops someone from forgetting to run an entry here).
The proper fix is introducing **Flyway** (`src/main/resources/db/migration/`,
versioned `V*__description.sql` files, `ddl-auto=validate` instead of
`update`), with a baseline migration capturing the current schema so existing
dev/Pi databases aren't broken. That's a separate, deliberate change — not
something to bolt on mid-feature against a shared DB.
