# Manual DB Changes Log

`spring.jpa.hibernate.ddl-auto=update` auto-creates tables and columns, but it
**never alters an existing CHECK constraint** — those have to be dropped and
recreated by hand. This file tracks every manual change so it survives a
restart/reinstall and doesn't live only in chat history.

Each entry below must be run **once per environment** (local dev DB, Pi
production DB) — check the "Applied to" line before running anything twice.

---

## 2026-11-08 — `organizacion_evidencia`: state `VENCIDA`, expiry backfill and reminder column (RN-04, D1)

**Reason**: accreditation evidence now expires one year after approval (`EVIDENCIA_VIGENCIA_MESES`, default 12). A daily job moves expired `APROBADA` evidence to the new state `VENCIDA` and appends the event `EVIDENCIA_VENCIDA` (actor `SISTEMA`). `ddl-auto=update` never widens the CHECK constraints it generated for STRING enums, so both new values would be rejected.

**Before**: `organizacion_evidencia.estado` allows PENDIENTE/APROBADA/OBSERVADA/REEMPLAZADA; `organizacion_evento.tipo` lacks `EVIDENCIA_VENCIDA`; `APROBADA` rows may have `valido_hasta IS NULL` (never expires); no column `recordatorio_vencimiento_at`.

**Migration** (two parts):

1. By `ddl-auto=update`, on the first boot of the new MS image: nullable column `recordatorio_vencimiento_at timestamptz` (set once when the "expires soon" reminder is sent). Additive.
2. `scripts/sql/V015__evidencia_vencida.sql` (run `make migrate`, then restart the MS). Drops any CHECK on `estado` / `tipo` that lacks the new value and recreates it with the full list; then backfills every `APROBADA` row with `valido_hasta IS NULL` to `GREATEST(revisado_en + 1 year, CURRENT_DATE + 30 days)` (`cargado_en` when `revisado_en` is NULL). The floor guarantees no backfilled date is earlier than the deployment date plus 30 days. Rows that already have a `valido_hasta` are not touched. Idempotent and transactional; verified twice on a throwaway `postgres:16`. `EsquemaVerificador` logs `ESQUEMA_PENDIENTE` while a CHECK still rejects the new values.

**Order on the Pi**: back up (`make backup`), deploy the new MS image and let it boot once (adds the column; the startup run of the job may fail per row with a constraint violation, logged and harmless, if V015 is not applied yet), run `make migrate` (V015), restart the MS so the startup run moves rows already past their date to `VENCIDA`. Applying V015 before the image also works (the script only needs the two tables).

**After**: `SELECT count(*) FROM organizacion_evidencia WHERE estado = 'APROBADA' AND valido_hasta IS NULL` is 0 after V015 (new approvals always set the date). `\d organizacion_evidencia` shows `organizacion_evidencia_estado_check` with VENCIDA.

**Rollback**: `UPDATE organizacion_evidencia SET estado = 'APROBADA' WHERE estado = 'VENCIDA';` and recreate the two CHECKs without the new values only if no `EVIDENCIA_VENCIDA` event exists (events cannot be deleted: V014 trigger), so in practice keep the CHECKs; the previous code ignores the extra column. The backfilled `valido_hasta` values are not reversible without the backup. The behaviour can be switched off by setting `EVIDENCIA_VIGENCIA_MESES` very high; there is no flag to disable the job.

**Applied to**: not applied to production by the author of this change; pending in every environment.

---

## 2026-11-08 — `organizacion_evento`: hash chain columns and immutability trigger (C4)

**Reason**: the accreditation event log is append-only in the application only. C4 chains its rows per organization (`hash = SHA-256(prev_hash || canonical content)`) so that an edited, deleted-in-the-middle or reordered event is detected, and adds a trigger so ad hoc SQL cannot edit or delete events. See `docs/tfg/seguridad-c4.md`.

**Before**: no `prev_hash` / `hash` columns, no unique index, no trigger. `organizacion_evento` accepted any UPDATE or DELETE from SQL.

**Migration** (three parts):

1. By `ddl-auto=update`, on the first boot of the new MS image: nullable columns `prev_hash varchar(64)` and `hash varchar(64)`, plus the unique index `ux_evento_org_prev_hash (organizacion_id, prev_hash)`. Existing rows keep `NULL`, which PostgreSQL treats as distinct, so the index builds on a table with history. Additive (RNF07).
2. The MS seals the existing rows at startup (`CadenaArranque`, on `ApplicationReadyEvent`): idempotent, resumable, in insertion order, one transaction per organization. It is Java and not SQL because the canonical encoding lives in `CadenaHash`.
3. `scripts/sql/V014__organizacion_evento_inmutable.sql` (run `make migrate`, after the MS has booted once with this code). Installs the trigger `organizacion_evento_inmutable` (rejects UPDATE, DELETE and TRUNCATE for every role, except the one-time sealing of a row with `hash IS NULL AND prev_hash IS NULL`) and revokes DELETE and TRUNCATE (and UPDATE when no row is left unsealed) from `PUBLIC` and from a non-superuser running role. Aborts with a clear message if the table or the `hash` column is missing. Idempotent and transactional. `EsquemaVerificador` logs `ESQUEMA_PENDIENTE` until the trigger exists.

**After**: `\d organizacion_evento` lists `prev_hash`, `hash`, the index `ux_evento_org_prev_hash` and the two triggers. `SELECT count(*) FROM organizacion_evento WHERE hash IS NULL` is 0 once the MS has started. The REVOKE does not bind a superuser (the compose default for the application role) and the owner can grant it back; only the trigger holds for every role, until it is dropped.

**Rollback**: `DROP TRIGGER organizacion_evento_inmutable ON organizacion_evento; DROP TRIGGER organizacion_evento_inmutable_truncate ON organizacion_evento; GRANT UPDATE, DELETE, TRUNCATE ON organizacion_evento TO <application role>;`. The columns and the unique index can stay (the previous code ignores them, and its inserts leave `NULL`, which the next start seals); to remove them: `DROP INDEX IF EXISTS ux_evento_org_prev_hash; ALTER TABLE organizacion_evento DROP COLUMN IF EXISTS hash, DROP COLUMN IF EXISTS prev_hash;`. Anchors already written to the bucket (`audit/anchors/`) are not removed by any rollback.

**Applied to**: columns, index and sealing happen automatically on first boot of the new image in each environment. V014: not applied to production by the author of this change; pending in every environment.

---

## 2026-11-08 — `organizacion_evidencia.archivo_eliminado_at`: retention marker (C3)

**Reason**: the optional retention job deletes the bucket file of replaced or long-expired accreditation evidence and records when, keeping the row and its events.

**Before**: no such column.

**Migration**: none by hand. The column is nullable with no default, which `ddl-auto=update` creates by itself when the new MS image first boots (the same way the earlier nullable columns were added), so no `scripts/sql` file and no `EsquemaVerificador` check exist for it. Existing rows keep `NULL`, meaning "file not deleted".

**After**: `\d organizacion_evidencia` lists `archivo_eliminado_at timestamp(6) with time zone`, nullable. Nothing writes it unless `EVIDENCIA_RETENCION_ENABLED=true`.

**Rollback**: `ALTER TABLE organizacion_evidencia DROP COLUMN IF EXISTS archivo_eliminado_at;` (only after turning the job off; any files it already deleted from the bucket do not come back).

**Applied to**: created automatically on first boot of the new image in each environment.

---

## 2026-11-08 — `asignaciones`: one PROPUESTA per donation (RN-08)

**Reason**: nothing in the database stopped two `PROPUESTA` assignments for the same donation if two rondas ever overlapped (the ronda lock was an in-process `ReentrantLock`, now a PostgreSQL advisory lock; this index is the second, independent guarantee).

**Before**: `asignaciones` had only the non-unique indexes `idx_asignaciones_donacion` and `idx_asignaciones_ronda`.

**Migration**: `scripts/sql/V013__asignaciones_una_activa_por_donacion.sql` (run `make migrate`). `CREATE UNIQUE INDEX IF NOT EXISTS ux_asignacion_activa_por_donacion ON asignaciones (donacion_id) WHERE estado = 'PROPUESTA'`. Idempotent. If any donation already has more than one `PROPUESTA` row the script aborts with the donation ids and changes nothing; set the stale rows to `CANCELADA` by hand and run it again. Skipped with a notice while the `asignaciones` table does not exist yet. `ACEPTADA` is deliberately not indexed (an admin override can leave an `ACEPTADA` row while the donation returns to the pool). Safe before or after deploying the new MS image: the image does not need the index, and `EsquemaVerificador` logs `ESQUEMA_PENDIENTE` until it exists.

**After**: `\d asignaciones` lists `ux_asignacion_activa_por_donacion` UNIQUE, btree (donacion_id) WHERE estado = 'PROPUESTA'.

**Rollback**: `DROP INDEX IF EXISTS ux_asignacion_activa_por_donacion;` (no data is touched either way).

**Applied to**:
- [ ] Local dev DB
- [ ] Pi production DB

---

## 2026-10-29 — `organizaciones (latitud, longitud)`: index for the map viewport query

**Reason**: the public home loads map pins per viewport (`GET /api/organizaciones/mapa/zona`, a lat/lng box filter) now that the table holds thousands of imported organizaciones. Without an index every pan is a sequential scan.

**Before**: no index on `organizaciones.latitud` / `organizaciones.longitud`.

**Migration**: `scripts/sql/V012__organizaciones_lat_lng_idx.sql` (run `make migrate`). `CREATE INDEX IF NOT EXISTS idx_organizaciones_lat_lng ON organizaciones (latitud, longitud)`. Additive, perf-only and safe before or after deploying the new MS image (the endpoint works without it, only slower). The entity does not declare it (`ddl-auto=update` would not manage it consistently with the script), and `EsquemaVerificador` has no check.

**After**: `\d organizaciones` lists `idx_organizaciones_lat_lng` btree (latitud, longitud).

**Rollback**: `DROP INDEX IF EXISTS idx_organizaciones_lat_lng;`

**Applied to**:
- [ ] Local dev DB
- [ ] Pi production DB

---

## 2026-10-15 — `poblacion_radio`: population per census radio (rondas-datos-vivos)

**Reason**: rondas compute the vulnerability `deficit` from the current database instead of numbers baked into the worker image. The population per 2022 census radio is the one input the database did not have.

**Before**: no `poblacion_radio` table.

**Migration**: `scripts/sql/V011__poblacion_radio.sql` (run `make migrate`), then load the data with `make importar-poblacion`. `CREATE TABLE IF NOT EXISTS poblacion_radio (codigo_radio varchar(9) PRIMARY KEY, habitantes integer NOT NULL CHECK (habitantes >= 0))`. Additive, re-runnable and safe before or after deploying the new MS image (the read-only `PoblacionRadio` entity maps the same columns, so `ddl-auto=update` is a no-op). `EsquemaVerificador` has no check: an empty or missing table makes every candidate's deficit NEUTRAL (1.0) and logs a WARN at ronda time, never an error.

**After**: `poblacion_radio` holds one row per radio with population; running `make importar-poblacion` again leaves identical contents.

**Rollback**: `DROP TABLE poblacion_radio;` (rondas fall back to NEUTRAL deficits).

**Note**: the same change starts writing `organizaciones.codigo_radio` for platform organizaciones (on create, edit and an hourly backfill). The column already exists, so there is no schema change and nothing to run for it.

**Applied to**:
- [ ] Local dev DB
- [ ] Pi production DB

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
