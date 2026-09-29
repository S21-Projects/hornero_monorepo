# Manual DB Changes Log

`spring.jpa.hibernate.ddl-auto=update` auto-creates tables and columns, but it
**never alters an existing CHECK constraint** — those have to be dropped and
recreated by hand. This file tracks every manual change so it survives a
restart/reinstall and doesn't live only in chat history.

Each entry below must be run **once per environment** (local dev DB, Pi
production DB) — check the "Applied to" line before running anything twice.

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
