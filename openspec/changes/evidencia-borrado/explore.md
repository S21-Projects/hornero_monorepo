# Exploration: evidencia-borrado (P2)

Mirror of Engram `sdd/evidencia-borrado/explore` (obs #751), condensed by the orchestrator.

## Goal (user decision 2026-10-13)

Claim evidence objects (`reclamo-evidencia/{orgId}/{userId}/{uuid}.{ext}`, R2 in prod, MinIO
locally) survive anonymization. Add (1) explicit deletion on anonymization and (2) a nightly orphan
sweep over `reclamo-evidencia/` as backstop (also covers the P3 429-after-upload orphans).

## Current state

- Only the BFF talks to the bucket (`UploadService` PutObject, `ImagesService` GetObject). No
  presigned URLs, no list/delete anywhere. The MS has no S3 dependency; compose passes `AWS_*` only
  to `bff` and `minio-init`.
- Keys live in `reclamo_organizacion_evidencias(reclamo_id, object_key)` (`@ElementCollection`,
  max 3 per claim). `ReclamoService.OBJECT_KEY_PATTERN` validates them.
- `UsuarioAnonimizacionService.anonimizar` (one `@Transactional` method) clears `evidenciaKeys` at
  line ~103 (`ReclamoOrganizacion::anonimizar`), so keys must be captured before that call.
  `docs/politica-datos-y-respaldo.md` §1.6 documents the objects as orphaned, pending decision.
- Patterns to reuse: `@TransactionalEventListener(AFTER_COMMIT)` (N13), `actividadService
  .registrarAislado` (REQUIRES_NEW, never throws) after commit, `CoordenadasMinimizacionJob` (cron
  Buenos Aires + startup catch-up, `Clock`, `.sistema()` summary row only when > 0).
- MS tests are `@SpringBootTest` + H2, no Testcontainers: the S3 bean must be conditional with a
  no-op default; tests use an in-memory fake of the port.
- Same bucket holds `org-evidencia/`, `org-banner/`, `org-profile/`: never swept.

## Approaches

| | A) MS own S3 client | B) MS → internal BFF endpoint | C) Outbox table + worker |
|---|---|---|---|
| Pros | MS owns the DB and the anonymization; reuses listener/job patterns | BFF already has the client | Durable retry |
| Cons | New dependency + bucket credentials in the MS | No MS→BFF auth channel; reverses dependency direction; chatty sweep | Extra table; the sweep already covers failed deletes |
| Effort | Medium | High | Medium–High |

## Recommendation

Approach A: port `EvidenciaAlmacen` (`listar`, `borrar`) with an S3 adapter (AWS SDK v2 `s3` +
`url-connection-client`, active only when configured) and a no-op fallback; event published inside
the anonymization tx with the captured keys, AFTER_COMMIT listener deletes them (`DeleteObjects`)
and records actividad via `registrarAislado`; nightly sweep (~03:50 BA + catch-up) deletes keys
matching `OBJECT_KEY_PATTERN`, unreferenced, older than grace (7 d), with kill switch and per-run
cap. Minimal tests against the fake; adapter verified manually on MinIO.

## Open questions

- Retention of evidence of decided claims of non-anonymized users (kept indefinitely today) —
  product decision, does not block this change.
- Delete the claimant's whole `reclamo-evidencia/*/{userId}/` set at anonymization (catches stray
  uploads) vs. relying on the sweep.
- Separate R2 token for the MS (R2 tokens scope per bucket, not per prefix).

## Risks

Bucket-wide delete rights in the MS; sweep false positives after a DB restore (grace + cap + prefix
filter; runbook: disable sweep after a restore); listener latency on the admin request; admin
actividad label test must be updated with new types; new env vars in `.env.example` are a user
action.
