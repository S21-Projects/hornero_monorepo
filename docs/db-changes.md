# Manual DB Changes Log

`spring.jpa.hibernate.ddl-auto=update` auto-creates tables and columns, but it
**never alters an existing CHECK constraint** — those have to be dropped and
recreated by hand. This file tracks every manual change so it survives a
restart/reinstall and doesn't live only in chat history.

Each entry below must be run **once per environment** (local dev DB, Pi
production DB) — check the "Applied to" line before running anything twice.

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
