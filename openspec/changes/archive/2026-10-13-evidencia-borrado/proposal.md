# Proposal: Claim evidence deletion (evidencia-borrado, P2)

## Intent

Claim evidence objects (`reclamo-evidencia/{orgId}/{userId}/{uuid}.{ext}`, R2 in production,
MinIO locally) survive user anonymization: `ReclamoOrganizacion::anonimizar` clears the key rows but
the bucket objects stay, unreferenced and personal. Uploads rejected after storage (P3 429 path)
leave orphans too. `docs/politica-datos-y-respaldo.md` §1.6 documents this as pending. The user
approved (2026-10-13) explicit deletion at anonymization plus a nightly orphan sweep as backstop.

Success: after an anonymization no object under `reclamo-evidencia/*/{userId}/` remains; orphans
older than the grace period are removed nightly; nothing outside `reclamo-evidencia/` is ever
touched; the MS still boots and tests still run without S3.

## Scope

### In Scope
- MS port `EvidenciaAlmacen` (list by prefix, batch delete) with an S3 adapter (AWS SDK v2), active
  only when bucket configuration is present, and a no-op fallback that logs a startup warning.
- Anonymization: capture the claim evidence keys before `ReclamoOrganizacion::anonimizar` clears
  them, publish an event inside the transaction; an `AFTER_COMMIT` listener deletes those keys and
  every other object under `reclamo-evidencia/*/{userId}/`. Records actividad via
  `registrarAislado` with a count only (never keys). Failures are logged and recorded, never undo the
  committed anonymization; the sweep is the retry.
- Nightly orphan sweep: prefix `reclamo-evidencia/`, keys matching `OBJECT_KEY_PATTERN`, not
  referenced by any claim row, `LastModified` older than grace (default 7 days), per-run cap
  (default 500), kill switch; cron ~03:50 America/Argentina/Buenos_Aires plus startup catch-up;
  summary actividad (`.sistema()`) only when > 0 objects deleted.
- `docker-compose.yml`: pass the existing `AWS_*` variables to `ms` (same credentials as the BFF).
- New actividad types: admin label in `ts_hornero_admin/src/lib/domain-ui.ts` + its enumeration test.
- Docs: `docs/politica-datos-y-respaldo.md` §1.6, `ReclamoOrganizacion.anonimizar` Javadoc,
  `docs/registro-actividades.md`, runbook note "disable the sweep after a DB restore until
  reconciled", note that R2 tokens scope per bucket (a separate MS token only separates revocation).
- Minimal strict-TDD tests: unit tests of listener and sweep against an in-memory fake of the port,
  one anonymization assertion that the event carries the captured keys. S3 adapter verified
  manually on MinIO (`make up-local`).

### Out of Scope
- Retention policy for evidence of decided claims of non-anonymized users (team decision, open).
- Organization evidence (`org-evidencia/`), banners and profiles: never listed or deleted.
- Outbox/durable retry table (the sweep covers failed deletes).
- A separate R2 token for the MS (user may do it later).
- Editing `.env*` files: adding the new variables to `.env.example` is a USER ACTION.
- Testcontainers or automated S3 adapter tests.

## Capabilities

### New Capabilities
- `reclamo-evidencia-borrado`: deletion of claim evidence objects on user anonymization and the
  nightly orphan sweep over `reclamo-evidencia/`, including safety bounds (prefix, key pattern,
  grace, cap, kill switch) and actividad recording.

### Modified Capabilities
- None (`reclamo-reporte-limites` keeps its requirements; the 429 orphans are handled by the new
  sweep without changing the limit behavior).

## Approach

Exploration approach A: the MS owns the database and the anonymization, so it gets its own S3
client behind a port. Rejected: B (MS calling a BFF endpoint reverses the dependency direction and
has no MS-to-BFF auth channel) and C (outbox table adds a table for a retry the sweep already
provides). Reuse existing patterns: `@TransactionalEventListener(AFTER_COMMIT)` (N13),
`actividadService.registrarAislado` (REQUIRES_NEW, never throws), `CoordenadasMinimizacionJob`
(Buenos Aires cron, `Clock`, startup catch-up, summary row only when > 0). Conditional bean keeps
H2 `@SpringBootTest` suites unaffected. Touches MS (main), admin SPA (label), compose and docs; BFF,
Astro and the Go worker are untouched; no JWT/access-rule change.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `jar_hornero_ms/pom.xml` | Modified | AWS SDK v2 `s3` + `url-connection-client` |
| `jar_hornero_ms/.../EvidenciaAlmacen` + S3/no-op adapters + config | New | Port, adapters, conditional wiring |
| `jar_hornero_ms/.../UsuarioAnonimizacionService` | Modified | Capture keys, publish event |
| `jar_hornero_ms/...` listener + sweep job | New | AFTER_COMMIT deletion, nightly sweep |
| `jar_hornero_ms/.../ReclamoOrganizacion` | Modified | `anonimizar` Javadoc |
| `jar_hornero_ms/src/main/resources/application.properties` | Modified | Sweep cron, grace, cap, kill switch, bucket |
| `jar_hornero_ms/.../TipoActividad` (or equivalent) | Modified | New actividad types |
| `ts_hornero_admin/src/lib/domain-ui.ts` + test | Modified | Labels for new actividad types |
| `docker-compose.yml` | Modified | `AWS_*` to `ms` |
| `docs/politica-datos-y-respaldo.md`, `docs/registro-actividades.md`, deploy runbook | Modified | Policy, actividad, restore note |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| MS gains bucket-wide delete rights (R2 tokens are per bucket) | Med | Prefix + key-pattern filter in code; separate token documented as later option |
| Sweep false positives after a DB restore (rows gone, objects present) | Low | 7-day grace, per-run cap, kill switch, runbook "disable sweep after restore" |
| Listener latency on the admin anonymization request | Low | Max ~a few objects per user; bounded list + one `DeleteObjects`; failure never propagates |
| Missing S3 config in prod silently disables deletion | Med | Startup warning from the no-op fallback; documented user action for env vars |
| Admin actividad enumeration test breaks on new types | High (by design) | Update labels and test in the same change |

## Rollback Plan

Set the sweep kill switch to off (configuration change plus `ms` restart, no code change) to stop
scheduled deletion. To fully
revert, revert the change commits: the port, listener and job are additive; the anonymization only
gains an event publication; no schema change, so no SQL rollback. Deleted objects are not
recoverable — the grace period, cap and prefix filter are the guard, and R2 bucket backups (if
enabled) are the only restore path.

## Dependencies

- AWS SDK v2 for Java (Maven).
- `AWS_ENDPOINT_URL`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `AWS_DEFAULT_REGION` available to `ms` (user adds sweep variables to `.env.example`).
- Local MinIO (`make up-local`) for manual adapter verification.

## Success Criteria

- [ ] Anonymizing a user with claim evidence removes every object under `reclamo-evidencia/*/{userId}/` after commit, and records one actividad with the count.
- [ ] A storage failure during deletion leaves the anonymization committed and records the failure.
- [ ] The sweep deletes only unreferenced `reclamo-evidencia/` keys matching `OBJECT_KEY_PATTERN` older than grace, never more than the cap, and does nothing when disabled.
- [ ] MS boots and `mvn test` passes with no S3 configuration (no-op adapter, warning logged).
- [ ] Admin `npm test` and `npm run build` pass with the new actividad labels.
- [ ] Manual MinIO run confirms deletion and sweep behavior.
